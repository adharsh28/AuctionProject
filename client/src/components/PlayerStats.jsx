import { CircleDot } from "lucide-react";
const PlayerStats = ({ player }) => {
  if (!player?.stats) return null;

  const { Batting, Bowling } = player.stats;

  return (
    <div className="flex justify-between items-center flex-col mt-4">
      {/* 🏏 Batting Stats */}
      {Batting && (
        <div className="flex items-center gap-8 font-text w-full">
          <div className="flex gap-2 justify-around w-full text-sm items-center text-mute font-semibold">
            <p className="flex flex-col items-center">
              Innings <span>{Batting.I}</span>
            </p>
            <p className="flex flex-col items-center text-mute font-heading">
              Runs <span>{Batting.R}</span>
            </p>
            <p className="flex flex-col items-center">
              Avg <span>{Batting.Avg}</span>
            </p>
            <p className="flex flex-col items-center">
              SR <span>{Batting.SR}</span>
            </p>
          </div>
        </div>
      )}

      {/* 🟡 Divider (only if All-rounder) */}
      {Batting && Bowling && (
        <div className="divider my-1 text-xs text-muted flex items-center justify-center gap-1 before:bg-border after:bg-border">
          <CircleDot className="w-3 h-3 text-role" />
          All-Rounder
          <CircleDot className="w-3 h-3 text-role" />
        </div>
      )}

      {/* 🎯 Bowling Stats */}
      {Bowling && (
        <div className="flex gap-8 items-center font-body w-full text-mute font-semibold">
          <div className="flex gap-2 justify-around w-full text-sm items-center">
            <p className="flex flex-col items-center">
              Innings <span>{Bowling.I}</span>
            </p>
            <p className="flex flex-col items-center font-heading">
              Wkts <span>{Bowling.W}</span>
            </p>
            <p className="flex flex-col items-center">
              Avg <span>{Bowling.Avg}</span>
            </p>
            <p className="flex flex-col items-center">
              Eco <span>{Bowling.Econ}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerStats;
