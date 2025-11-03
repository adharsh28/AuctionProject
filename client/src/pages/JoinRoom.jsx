import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";

function JoinRoom() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const navigate = useNavigate();

  const handleJoin = () => {
    localStorage.setItem("name", name);
    socket.emit("join-room", { roomCode, name });
    navigate(`/room/${roomCode}`);
  };

  return (
    <div className="bg-muted min-h-screen flex justify-center items-center">
      <div className="w-full max-w-md rounded-xl shadow-lg p-10 flex flex-col gap-4 shadow-black bg-bg">
        <h2 className="text-2xl font-heading text-text text-center mb-2">
          Join Room
        </h2>

        {/* --- Intro Section --- */}
        <p className="text-sm text-text/80 text-center font-text mb-3 leading-relaxed">
          Ready to jump into the action? 🏏  
          Enter your team name and the <span className="font-semibold">Room Code</span> shared by your host to join the live auction room.  
          Get your bidding strategy ready — every player counts!
        </p>

     

        {/* Team Name */}
        <div className="flex flex-col gap-1 font-text font-semibold mt-3">
          <label htmlFor="name" className="text-sm font-medium text-text">
            Team Name
          </label>
          <input
            placeholder="Your Team or Franchise Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full text-xs"
          />
          <p className="text-[11px] text-text/60">
            Example: Mumbai Tigers, Chennai Smashers, or your dream franchise name!
          </p>
        </div>

        {/* Room Code */}
        <div className="flex flex-col gap-1 font-text font-semibold">
          <label htmlFor="roomCode" className="text-sm font-medium text-text">
            Room Code
          </label>
          <input
            placeholder="Enter Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            className="input w-full text-xs"
          />
          <p className="text-[11px] text-text/60">
            Paste or type the code your host sent you — example: <span className="font-mono">52317</span>
          </p>
        </div>

        {/* Join Button */}
        <div className="flex justify-center mt-4 font-body">
          <button
            onClick={handleJoin}
            className="btn btn-wide bg-org text-white font-semibold hover:scale-105 transition-all duration-200"
          >
            Join Room
          </button>
        </div>

        {/* Friendly Footer / Additional Info */}
        <div className="mt-4 bg-black/5 p-3 rounded-lg text-xs text-text/70 font-text leading-relaxed">
          <p>
            🎯 Once you join, your name will appear in the auction lobby alongside other managers.  
            Wait for the host to start the auction, and be ready to make your first bid!
          </p>
        </div>

        <p className="text-center text-xs text-text/60 mt-3">
          Having trouble joining? Double-check your room code or confirm that the room is still active.
        </p>
      </div>
    </div>
  );
}

export default JoinRoom;
