/* eslint-disable no-unused-vars */
import { motion } from "framer-motion";
import PlayerIntro from "./PlayerIntro";

export default function PlayerCard({ player }) {
  const playerKey = `${player.name}|${player.nation}|${player.role}`;

  return (
    <div className="w-full bg-bg rounded-xl p-3 flex flex-col items-center">
      {/* 🎬 Player Intro Animation */}
      <PlayerIntro
        name={player?.name}
        nation={player?.nation}
        role={player?.role}
        team={player?.team}
      />

      {/* 🎯 Player Info Section */}
      <motion.div
        key={playerKey}
        initial={{ opacity: 0, y: 15, scale: 0.95, filter: "blur(4px)" }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          transition: { delay: 2, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
        }}
        className="w-full"
      >
        <div className="text-sm font-text flex justify-between items-center mt-1">
          <p className="font-semibold font-body text-role">{player?.role}</p>
          <p className="flex flex-col items-center font-semibold text-sm">
            {player?.nation}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
