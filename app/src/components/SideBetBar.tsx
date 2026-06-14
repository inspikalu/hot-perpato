"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  solPrice: number;
  positionPnl: number;
  sideBetActive: boolean;
  tradeType: "LONG" | "SHORT";
  entryPrice: number;
  leverage: number;
  onInit: (type: "LONG" | "SHORT") => void;
  onExecute: (amount: string, leverage: number, type: "LONG" | "SHORT") => void;
  loading: boolean;
};

export function SideBetBar({ solPrice, positionPnl, sideBetActive, tradeType, entryPrice, leverage, onInit, onExecute, loading }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("10");
  const [lev, setLev] = useState(100);

  if (!sideBetActive && !open) {
    return (
      <div className="flex justify-center gap-3 mb-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { onInit("LONG"); setOpen(true); }}
          disabled={loading}
          className="pixel-border-green bg-pixel-green/20 px-4 py-2 font-pixel text-[8px] text-pixel-green pixel-btn cursor-pointer disabled:opacity-40"
        >
          LONG SIDE-BET
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { onInit("SHORT"); setOpen(true); }}
          disabled={loading}
          className="pixel-border-red bg-pixel-red/20 px-4 py-2 font-pixel text-[8px] text-pixel-red pixel-btn cursor-pointer disabled:opacity-40"
        >
          SHORT SIDE-BET
        </motion.button>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <AnimatePresence>
        {open && !sideBetActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="pixel-border bg-pixel-dark p-4 mb-3"
          >
            <p className="font-pixel text-[8px] text-pixel-yellow mb-3">
              {tradeType === "LONG" ? "LONG" : "SHORT"} SIDE-BET @ ${solPrice.toFixed(2)}
            </p>
            <div className="flex gap-3 items-end">
              <div>
                <label className="font-pixel text-[7px] text-pixel-grey block mb-1">AMOUNT (USDC)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pixel-border-sm bg-pixel-black px-3 py-2 font-pixel text-[10px] text-pixel-white w-24 outline-none"
                />
              </div>
              <div>
                <label className="font-pixel text-[7px] text-pixel-grey block mb-1">LEVERAGE</label>
                <select
                  value={lev}
                  onChange={(e) => setLev(Number(e.target.value))}
                  className="pixel-border-sm bg-pixel-black px-3 py-2 font-pixel text-[10px] text-pixel-white outline-none"
                >
                  {[10, 25, 50, 100].map((l) => (
                    <option key={l} value={l}>{l}x</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => { onExecute(amount, lev, tradeType); setOpen(false); }}
                disabled={loading}
                className={`pixel-border px-4 py-2 font-pixel text-[8px] pixel-btn cursor-pointer disabled:opacity-40 ${
                  tradeType === "LONG"
                    ? "bg-pixel-green text-pixel-black border-pixel-green"
                    : "bg-pixel-red text-pixel-white border-pixel-red"
                }`}
              >
                {loading ? "..." : "OPEN"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {sideBetActive && (
        <div className={`pixel-border p-3 text-center ${
          positionPnl >= 0 ? "pixel-border-green" : "pixel-border-red"
        }`}>
          <p className="font-pixel text-[8px] text-pixel-grey">
            {tradeType === "LONG" ? "LONG" : "SHORT"} @ ${entryPrice.toFixed(2)} ({leverage}x)
          </p>
          <p className={`font-pixel text-sm ${positionPnl >= 0 ? "text-pixel-green" : "text-pixel-red"}`}>
            {positionPnl >= 0 ? "+" : ""}{positionPnl.toFixed(1)}%
          </p>
        </div>
      )}
    </div>
  );
}
