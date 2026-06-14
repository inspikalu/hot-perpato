"use client";

import { motion } from "framer-motion";

const LEADERBOARD = [
  { rank: 1, name: "BEAST", score: 47, wins: 12, games: 15 },
  { rank: 2, name: "ALPHA", score: 32, wins: 8, games: 14 },
  { rank: 3, name: "CHILL", score: 28, wins: 7, games: 13 },
  { rank: 4, name: "DEGEN", score: 15, wins: 4, games: 12 },
  { rank: 5, name: "WHALE", score: 10, wins: 3, games: 10 },
];

export default function LeaderboardPage() {
  return (
    <div className="flex flex-col items-center px-4 py-8 flex-1">
      <div className="scanlines absolute inset-0 pointer-events-none" />

      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-pixel text-2xl text-pixel-yellow mb-8"
      >
        LEADERBOARD
      </motion.h1>

      <div className="w-full max-w-md pixel-border bg-pixel-dark overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-pixel-light font-pixel text-[10px] text-pixel-grey">
          <span>#</span>
          <span>PLAYER</span>
          <span className="text-right">W/L</span>
          <span className="text-right">SCORE</span>
        </div>

        {/* Rows */}
        {LEADERBOARD.map((entry, i) => (
          <motion.div
            key={entry.rank}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`grid grid-cols-4 gap-2 px-4 py-3 font-pixel text-xs ${
              i < 3 ? "bg-pixel-black" : ""
            } border-t border-pixel-grey`}
          >
            <span className={i === 0 ? "text-pixel-yellow" : "text-pixel-grey"}>
              {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
            </span>
            <span className="text-pixel-white">{entry.name}</span>
            <span className="text-right text-pixel-grey text-[10px]">
              {entry.wins}/{entry.games}
            </span>
            <span className="text-right text-pixel-green">{entry.score}</span>
          </motion.div>
        ))}
      </div>

      <p className="font-pixel text-[8px] text-pixel-grey mt-6">
        RESETS DAILY AT 00:00 UTC
      </p>
    </div>
  );
}
