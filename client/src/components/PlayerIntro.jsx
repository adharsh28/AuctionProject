/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export default function PlayerIntro({ name = "", nation = "", role = "", team = "" }) {
  const [showIntro, setShowIntro] = useState(true);
  const timerRef = useRef(null);

  const playerKey = `${String(name)}|${String(nation)}|${String(role)}|${String(team)}`;

  useEffect(() => {
    setShowIntro(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowIntro(false), 2200);
    return () => clearTimeout(timerRef.current);
  }, [playerKey]);

  const nameVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  const roleVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { delay: 0.3, duration: 0.5 } },
  };

  const isFlag = nation && nation.length <= 3;
  const countryText = isFlag ? "" : nation;
  const flagEmoji = isFlag ? nation : "";

  return (
    <div className="w-full flex items-center justify-center">
      {showIntro ? (
        <motion.div
         layout={false}
          key={`${playerKey}-intro`}
          initial="hidden"
          animate="show"
          variants={nameVariants}
          className="flex flex-col items-center justify-center px-6 py-3 rounded-2xl"
        >
          <motion.div
            variants={nameVariants}
            className="flex items-center gap-2 text-2xl font-semibold text-org font-text"
          >
            {flagEmoji && <span style={{ fontSize: 22 }}>{flagEmoji}</span>}
            {countryText && <span>{countryText}</span>}
          </motion.div>
          <motion.div
            variants={roleVariants}
            className="text-xs uppercase mt-1 text-batting font-text"
          >
            {role || "Player"}
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          key={`${playerKey}-main`}
           layout={false}
          initial="hidden"
          animate="show"
          variants={nameVariants}
          className="flex flex-col items-center justify-center px-6 py-3 rounded-2xl"
        >
          <motion.p
            variants={nameVariants}
            className="text-2xl text-center font-heading text-playerName font-extrabold"
          >
            {name || "Unknown Player"}
          </motion.p>
          <motion.p
            variants={roleVariants}
            className="text-sm mt-1 font-medium text-text"
          >
            {team || "Unknown Team"}
          </motion.p>
        </motion.div>
      )}
    </div>
  );
}
