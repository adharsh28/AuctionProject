/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";
import { Copy, Home, Check } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";

function TeamSquad() {
  const [team, setTeam] = useState([]);
  const [room, setRoom] = useState(null);
  const [matchResult, setMatchResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const playerName = localStorage.getItem("name"); // current user's team name (ex: "csk")
  // const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
  // const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const navigate = useNavigate();

  // ✅ Fetch team and room info
  useEffect(() => {
    socket.emit("get-team", { playerName });
    socket.emit("get-room");

    socket.on("team-data", (data) => {
      if (Array.isArray(data)) setTeam(data);
      else setTeam(data.team || []);
    });

    socket.on("room-data", (room) => {
      // console.log("📦 Room received:", room);
      if (room) {
        setRoom(room);
        localStorage.setItem("roomData", JSON.stringify(room)); // ✅ save in localStorage
      }
    });

    // socket.on("matchSimulated", (result) => {
    //   console.log("✅ Match simulation result received:", result);
    //   setMatchResult(result);
    //   setLoading(false);
    // });

    // ✅ If no socket data yet (after refresh), restore from localStorage
    const savedRoom = localStorage.getItem("roomData");
    if (savedRoom && !room) {
      setRoom(JSON.parse(savedRoom));
    }

    return () => {
      socket.off("team-data");
      socket.off("room-data");
      // socket.off("matchSimulated");
    };
  }, [playerName]);

  // ✅ Copy team to clipboard
  const handleCopy = () => {
    const formatted = team
      .map((p) => `${p.name} — ${p.role} — ₹${p.price} Cr — ${p.nation}`)
      .join("\n");
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ✅ Group players by role
  const grouped = {
    BATTER: team.filter((p) => p.role?.toLowerCase() === "batter"),
    "ALL-ROUNDER": team.filter((p) => p.role?.toLowerCase() === "all-rounder"),
    BOWLER: team.filter((p) => p.role?.toLowerCase() === "bowler"),
    "WK-BATTER": team.filter((p) => p.role?.toLowerCase() === "wk-batter"),
  };

  // ✅ Simulate match
  // async function simulateMatch(customPrompt) {
  //   if (!room || room.creator !== playerName) {
  //     alert("Only the host can simulate the match!");
  //     return;
  //   }

  //   setLoading(true);
  //   setMatchResult("Simulating match... please wait ⏳");

  //   socket.emit("simulate-match", {
  //     roomCode: room.roomCode,
  //     prompt: customPrompt,
  //   });
  // }

  // console.log("room:", room);
  // console.log("playerName:", playerName);

  return (
    <div className="min-h-screen bg-aucBG text-font font-text p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-playerName mb-4 sm:mb-0">
          {playerName}'s Squad
        </h2>

        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className={`btn btn-outline border-font text-font rounded-xl transition-all hover:text-highlight ${
              copied ? "btn-success" : "btn-neutral"
            }`}
          >
            {copied ? (
              <>
                <Check size={18} /> Copied!
              </>
            ) : (
              <>
                <Copy size={18} /> Copy Team
              </>
            )}
          </button>

          <button
            onClick={() => navigate("/")}
            className="btn btn-outline text-font rounded-xl hover:text-white"
          >
            <Home size={18} /> Home
          </button>
        </div>
      </div>

      {/* 🧠 Display team */}
      {team.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-lg text-muted">No players assigned yet.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(grouped).map(([role, players]) =>
            players.length > 0 ? (
              <div key={role}>
                <h3 className="text-xl font-semibold text-role border-b border-border pb-2 mb-4">
                  {role}
                </h3>

                <ul className="list bg-card rounded-box shadow-md border border-border">
                  <li className="p-3 pb-2 text-xs opacity-60 tracking-wide border-b border-border">
                    #{""} &nbsp;&nbsp; Player Name &nbsp;&nbsp;|&nbsp;&nbsp;
                    Role &nbsp;&nbsp;|&nbsp;&nbsp; Nation
                    &nbsp;&nbsp;|&nbsp;&nbsp; Price (Cr)
                    &nbsp;&nbsp;|&nbsp;&nbsp; Owner
                  </li>

                  {players.map((p, i) => (
                    <li
                      key={i}
                      className="list-row flex items-center justify-between p-3 border-b border-border hover:bg-[#121b35]/5 transition-all duration-150"
                    >
                      <div className="flex items-center gap-4 w-full">
                        <div className="text-lg font-thin opacity-40 tabular-nums w-10 text-center">
                          {String(i + 1).padStart(2, "0")}
                        </div>

                        <div className="flex justify-between w-full items-center text-sm sm:text-base">
                          <div className="font-semibold text-playerName w-1/4">
                            {p.name}
                          </div>

                          <div className="text-xs sm:text-sm opacity-80 w-1/5 text-center uppercase">
                            {p.role}
                          </div>

                          <div className="text-xs sm:text-sm opacity-80 w-1/5 text-center">
                            {p.nation}
                          </div>

                          <div className="text-xs sm:text-sm font-semibold w-1/5 text-center">
                            ₹{p.price}
                          </div>

                          <div className="text-xs sm:text-sm text-highlight font-semibold w-1/5 text-right">
                            {playerName}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* 🏏 Simulate match (Host only) */}
      {/* {room && room.creator?.toLowerCase() === playerName?.toLowerCase() && (
        <div className="mt-8 space-y-4 ">
          <p className="font-heading">Match Simulation</p>
          <textarea
            placeholder="Enter your custom simulation prompt (optional)"
            className="w-full bg-card border border-border rounded-lg p-3 text-sm text-font placeholder:text-muted focus:outline-none focus:border-highlight font-text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
          />

          <button
            onClick={() => simulateMatch(customPrompt)}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 font-body"
          >
            {loading ? "Simulating... " : "Simulate Match"}
          </button>
        </div>
      )} */}

      {/* 🧠 Gemini Match Result */}
      {/* {matchResult && (
        <div className="mt-8 bg-card p-4 rounded-xl border border-border whitespace-pre-wrap text-sm">
          {matchResult}
        </div>
      )} */}
    </div>
  );
}

export default TeamSquad;
