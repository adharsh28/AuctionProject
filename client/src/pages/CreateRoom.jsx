import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";
import axios from "axios";
import { API_BASE_URL } from "../config";

function generateRoomCode() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

function CreateRoom() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [budget, setBudget] = useState("");
  const [dataset, setDataset] = useState("ipl");
  const [totalPlayersPerTeam, setTotalPlayersPerTeam] = useState("");
  const [maxForeignPlayers, setMaxForeignPlayers] = useState("");
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setRoomCode(generateRoomCode());
  }, []);

  const handleCopy = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // reset after 2 sec
    }
  };



  const handleCreate = async () => {
    if (
      !name ||
      !maxPlayers ||
      !budget ||
      !totalPlayersPerTeam ||
      maxForeignPlayers === null ||
      maxForeignPlayers === "" ||
      isNaN(Number(maxForeignPlayers))
    ) {
      alert("Please fill all fields including a valid foreign player limit");
      return;
    }

    localStorage.setItem("name", name);
    try {
      await axios.post(`${API_BASE_URL}/api/create-room`, {
        creator: name,
        roomCode,
        maxPlayers,
        budget: Number(budget),
        dataset: dataset.toLowerCase(),
        totalPlayersPerTeam,
        maxForeignPlayers: Number(maxForeignPlayers) || 0,
      });

      socket.emit("create-room", {
        roomCode,
        maxPlayers,
        name,
        budget: Number(budget),
        dataset: dataset.toLowerCase(),
        totalPlayersPerTeam,
        maxForeignPlayers: Number(maxForeignPlayers),
      });

      navigate(`/room/${roomCode}`);
    } catch (err) {
      console.error("❌ Error creating room:", err);
      alert("Failed to create room. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center px-4 bg-muted py-4">
      <div className="w-full max-w-md rounded-xl shadow-lg p-10 flex flex-col gap-4 shadow-black bg-bg">
        <h2 className="text-2xl font-heading text-text text-center mb-2">
          Create Room
        </h2>

        {/* Info Section */}
        <p className="text-sm text-text/80 text-center font-text mb-3">
          Welcome, team manager!   
          Create your own cricket auction room and invite your friends to join.
        </p>

        {/* Team Name */}
        <div className="flex flex-col gap-1 font-text font-semibold">
          <label htmlFor="name" className="text-sm font-medium text-text">
            Team Name
          </label>
          <input
            placeholder="Your Team or Franchise Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full text-xs"
          />
        </div>

        {/* Max Teams */}
        <div className="flex flex-col gap-1 font-text font-semibold">
          <label htmlFor="maxPlayers" className="text-sm font-medium text-text">
            Max Teams
          </label>
          <select
            id="maxPlayers"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(e.target.value)}
            className="select w-full text-xs"
          >
            <option value="">Select Max Teams</option>
            {[2, 3, 4, 5, 6, 7, 8].map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
        </div>

        {/* Budget */}
        <div className="flex flex-col gap-1 font-text font-semibold">
          <label htmlFor="budget" className="text-sm font-medium text-text">
            Budget
          </label>
          <input
            type="number"
            placeholder="Budget (in Cr)"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            min={1}
            className="input w-full text-xs text-tex"
          />
        </div>

        {/* Players per Team */}
        <div className="flex flex-col gap-1 font-text font-semibold">
          <label className="text-sm font-medium text-text">
            Max Players per Team
          </label>
          <select
            value={totalPlayersPerTeam}
            onChange={(e) => setTotalPlayersPerTeam(e.target.value)}
            className="select w-full text-xs"
          >
            <option value="">Select Max Players</option>
            {[5,11, 12, 15, 18, 22, 25].map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
        </div>

        {/* Foreign Players */}
        <div className="flex flex-col gap-1 font-text font-semibold">
          <label className="text-sm font-medium text-text">
            Max Foreign Players
          </label>
          <select
            value={maxForeignPlayers}
            onChange={(e) => setMaxForeignPlayers(e.target.value)}
            className="select w-full text-xs"
          >
            <option value="">Select Max Overseas</option>
            {[2, 4, 5, 6, 7, 8, 10].map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
        </div>

        {/* League Selection */}
        <div className="flex flex-col gap-1 font-text font-semibold">
          <label htmlFor="dataset" className="text-sm font-medium text-text">
            League
          </label>
          <select
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
            className="select w-full text-xs"
          >
            <option value="ipl">IPL</option>
            <option value="hundred">Hundred</option>
            <option value="sa20">SA20</option>
            <option value="cpl">CPL</option>
            <option value="bbl">BBL</option>
            <option value="mlc">MLC</option>
            <option value="test">Test (5 Players)</option>
          </select>
        </div>

        {/* Room Code with Copy Feature */}
        <div className="mt-4 bg-black/5 p-3 rounded-lg flex justify-between items-center text-xs text-text/80 font-text">
          <div>
            <p className="font-semibold text-sm">🎟️ Room Code</p>
            <p className="text-base font-bold tracking-wide text-highlight">
              {roomCode || "Generating..."}
            </p>
          </div>
          <button
            onClick={handleCopy}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-200 ${
              copied ? "bg-green-500 text-white" : "bg-org text-white hover:scale-105"
            }`}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* Create Button */}
        <div className="flex justify-center mt-4 font-body">
          <button
            onClick={handleCreate}
            className="btn btn-wide bg-org text-white font-semibold hover:scale-105 transition-all duration-200"
          >
            Create
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-highlight mt-3 font-text">
          Share the room code with your friends once created and start bidding for your dream team 🏆
        </p>
      </div>
    </div>
  );
}

export default CreateRoom;
