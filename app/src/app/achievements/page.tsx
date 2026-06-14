"use client";

import { motion } from "framer-motion";

const ACHIEVEMENTS = [
  { id: 1, name: "ICE HANDS", desc: "Hold the potato for 10+ seconds", icon: "🧊", unlocked: true },
  { id: 2, name: "HOT PASS", desc: "Pass within 1 second of receiving", icon: "🔥", unlocked: true },
  { id: 3, name: "GRIM REAPER", desc: "Cause 3 liquidations in one match", icon: "💀", unlocked: false },
  { id: 4, name: "SURVIVOR", desc: "Win without ever being liquidated", icon: "🛡️", unlocked: true },
  { id: 5, name: "THE DUMP", desc: "Most passes in a day", icon: "📤", unlocked: false },
  { id: 6, name: "DEGENERATE", desc: "Play 50 rounds", icon: "🎰", unlocked: true },
  { id: 7, name: "FIRST BLOOD", desc: "First liquidation of the day", icon: "🩸", unlocked: false },
  { id: 8, name: "COMEBACK KING", desc: "Win after being first liquidated", icon: "👑", unlocked: false },
  { id: 9, name: "HOT STREAK", desc: "Win 3 matches in a row", icon: "⚡", unlocked: false },
];

export default function AchievementsPage() {
  return (
    <div className="flex flex-col items-center px-4 py-8 flex-1">
      <div className="scanlines absolute inset-0 pointer-events-none" />

      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-pixel text-2xl text-pixel-yellow mb-8"
      >
        BADGES
      </motion.h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-2xl">
        {ACHIEVEMENTS.map((ach, i) => (
          <motion.div
            key={ach.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`pixel-border p-4 text-center ${
              ach.unlocked ? "bg-pixel-dark" : "bg-pixel-dark/50"
            }`}
          >
            <div className={`text-3xl mb-2 ${!ach.unlocked ? "grayscale opacity-40" : ""}`}>
              {ach.icon}
            </div>
            <p className={`font-pixel text-[9px] mb-1 ${ach.unlocked ? "text-pixel-white" : "text-pixel-grey"}`}>
              {ach.name}
            </p>
            <p className="font-pixel text-[7px] text-pixel-grey">
              {ach.desc}
            </p>
            <p className={`font-pixel text-[8px] mt-2 ${ach.unlocked ? "text-pixel-green" : "text-pixel-grey"}`}>
              {ach.unlocked ? "UNLOCKED" : "LOCKED"}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
