"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useProgram, gamePda, delegateGame, BN } from "@/lib/anchor";
import { SystemProgram } from "@solana/web3.js";

type StakeMode = "free" | "buyin";

export default function Lobby() {
  const router = useRouter();
  const solWallet = useWallet();
  const program = useProgram(solWallet);
  const [showCreate, setShowCreate] = useState(false);
  const [stakeMode, setStakeMode] = useState<StakeMode>("free");
  const [players, setPlayers] = useState(4);
  const [rounds, setRounds] = useState(7);
  const [gameId, setGameId] = useState(0);
  const [joinCode, setJoinCode] = useState("");
  const [bombExploded, setBombExploded] = useState(false);
  const [creating, setCreating] = useState(false);

  const createGame = useCallback(async () => {
    const adapter = solWallet?.wallet?.adapter;
    if (!program || !adapter?.publicKey) return;
    setCreating(true);
    try {
      const [pda] = gamePda(adapter.publicKey, gameId);
      const config = {
        gameId: new BN(gameId),
        maxPlayers: players,
        totalRounds: rounds,
        stakeMode: { free: {} },
        buyInAmount: new BN(0),
      };
      await (program.methods as any)
        .createGame(config)
        .accounts({
          game: pda,
          user: adapter.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await delegateGame(program, pda, adapter.publicKey);

      return `${adapter.publicKey.toBase58()}:${gameId}`;
    } catch (err) {
      console.error("createGame failed:", err);
      return null;
    } finally {
      setCreating(false);
    }
  }, [program, solWallet, players, rounds, gameId]);

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="scanlines absolute inset-0 pointer-events-none" />

      {/* Background bomb animation */}
      <motion.div
        className="absolute text-8xl opacity-5 pointer-events-none select-none"
        animate={{
          y: [0, -20, 0],
          rotate: [0, 5, -5, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        💣
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center z-10"
      >
        <h1 className="font-pixel text-3xl sm:text-5xl text-pixel-red text-shadow-pixel mb-2">
          HOT PERP
        </h1>
        <p className="font-pixel text-xs sm:text-sm text-pixel-yellow mb-8">
          TRADE OR BURN
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setShowCreate(true); setBombExploded(false); }}
            className="pixel-border-red bg-pixel-red px-8 py-4 font-pixel text-xs text-pixel-white pixel-btn cursor-pointer"
          >
            CREATE GAME
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="pixel-border bg-pixel-light px-8 py-4 font-pixel text-xs text-pixel-white pixel-btn cursor-pointer"
          >
            QUICK JOIN
          </motion.button>
        </div>

        {/* Join by code */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (joinCode.length >= 3) {
              const parts = joinCode.replace(/\s/g, "").split(":");
              const authority = parts[0];
              const gid = parts[1] || "0";
              router.push(`/game/${authority}/${gid}`);
            }
          }}
          className="flex items-center gap-2 justify-center"
        >
          <input
            type="text"
            placeholder="ENTER CODE (pubkey:game_id)"
            maxLength={60}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            aria-label="Game code"
            autoComplete="off"
            spellCheck={false}
            className="pixel-border-sm bg-pixel-dark px-4 py-3 font-pixel text-xs text-pixel-white text-center uppercase w-52 outline-none focus-visible:ring-2 focus-visible:ring-pixel-blue placeholder:text-pixel-grey"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            className="pixel-border bg-pixel-blue px-4 py-3 font-pixel text-[10px] text-pixel-white pixel-btn cursor-pointer"
          >
            JOIN
          </motion.button>
        </form>
      </motion.div>

      {/* Create Game Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="pixel-border bg-pixel-dark p-8 w-full max-w-md"
            >
              <h2 className="font-pixel text-sm text-pixel-yellow mb-6 text-center">
                NEW LOBBY
              </h2>

              {/* Players */}
              <div className="mb-5">
                <label className="font-pixel text-[10px] text-pixel-grey block mb-2">PLAYERS</label>
                <div className="flex gap-2">
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setPlayers(n)}
                      className={`flex-1 py-3 font-pixel text-xs pixel-btn cursor-pointer ${
                        players === n
                          ? "pixel-border-green bg-pixel-green text-pixel-black"
                          : "pixel-border bg-pixel-light text-pixel-white"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rounds */}
              <div className="mb-5">
                <label className="font-pixel text-[10px] text-pixel-grey block mb-2">ROUNDS</label>
                <div className="flex gap-2">
                  {[5, 7, 9].map((n) => (
                    <button
                      key={n}
                      onClick={() => setRounds(n)}
                      className={`flex-1 py-3 font-pixel text-xs pixel-btn cursor-pointer ${
                        rounds === n
                          ? "pixel-border-green bg-pixel-green text-pixel-black"
                          : "pixel-border bg-pixel-light text-pixel-white"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stake Mode */}
              <div className="mb-6">
                <label className="font-pixel text-[10px] text-pixel-grey block mb-2">STAKES</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStakeMode("free")}
                    className={`flex-1 py-3 font-pixel text-xs pixel-btn cursor-pointer ${
                      stakeMode === "free"
                        ? "pixel-border-blue bg-pixel-blue text-pixel-white"
                        : "pixel-border bg-pixel-light text-pixel-white"
                    }`}
                  >
                    FREE
                  </button>
                  <button
                    onClick={() => setStakeMode("buyin")}
                    className={`flex-1 py-3 font-pixel text-xs pixel-btn cursor-pointer ${
                      stakeMode === "buyin"
                        ? "pixel-border-red bg-pixel-red text-pixel-white"
                        : "pixel-border bg-pixel-light text-pixel-white"
                    }`}
                  >
                    $5 USDC
                  </button>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={async () => {
                  const code = await createGame();
                  if (code) {
                    const [pubkey, gid] = code.split(":");
                    setShowCreate(false);
                    setBombExploded(true);
                    setTimeout(() => router.push(`/game/${pubkey}/${gid}`), 800);
                  }
                }}
                disabled={creating || !solWallet.connected}
                className="w-full pixel-border-red bg-pixel-red py-4 font-pixel text-xs text-pixel-white pixel-btn cursor-pointer disabled:opacity-40"
              >
                {creating ? "CREATING..." : "START LOBBY"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explosion feedback */}
      <AnimatePresence>
        {bombExploded && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <span className="text-8xl">💥</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
