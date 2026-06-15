"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import { useGame } from "@/hooks/useGame";
import { useFlashSession } from "@/hooks/useFlashSession";
import { SideBetBar } from "@/components/SideBetBar";

export default function GamePage() {
  const params = useParams();
  const authority = typeof params.authority === "string" ? params.authority : "";
  const gameCode = typeof params.gameCode === "string" ? params.gameCode : "0";
  const gameId = `${authority}:${gameCode}`;
  const {
    phase, currentHolder, timer, round, totalRounds, maxPlayers,
    players, solPrice, positionPnl, showExplosion, explodedPlayer,
    isHolding, isAuthority, hasJoined, gameNotFound, joinGame, startRound, passPotato,
    endRound, commitAndPayout,
    connected, wallet, gameAddress,
  } = useGame(gameId);

  const { sideBet, loading, executeSideBet, initSideBet, signAndSendSessionTx, pendingSessionTx, pendingSessionType } = useFlashSession(solPrice);

  return (
    <div className="flex flex-col flex-1 p-4 relative overflow-hidden">
      <div className="scanlines absolute inset-0 pointer-events-none" />

      {/* Top bar: Round + Price + Side Bets */}
      <div className="flex justify-between items-center mb-4 font-pixel text-[10px] sm:text-xs">
        <div className="text-pixel-blue">
          ROUND {round}/{totalRounds}
        </div>
        <div className="flex gap-4">
          <span className="text-pixel-green">
            SOL ${solPrice.toFixed(2)}
          </span>
          <span className={positionPnl >= 0 ? "text-pixel-green" : "text-pixel-red"}>
            {positionPnl >= 0 ? "+" : ""}{positionPnl.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Side Bets */}
      <SideBetBar
        solPrice={solPrice}
        positionPnl={positionPnl}
        sideBetActive={sideBet.active}
        tradeType={sideBet.tradeType}
        entryPrice={sideBet.entryPrice}
        leverage={sideBet.leverage}
        onInit={initSideBet}
        onExecute={executeSideBet}
        onSignSession={signAndSendSessionTx}
        pendingSessionTx={pendingSessionTx}
        pendingSessionType={pendingSessionType}
        loading={loading}
      />
      {/* Timer */}
      <div className="flex justify-center mb-6">
        <motion.div
          key={timer}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          className={`font-pixel text-5xl sm:text-7xl ${
            timer <= 5 ? "text-pixel-red" : "text-pixel-white"
          } ${timer <= 5 ? "animate-pulse" : ""}`}
        >
          {timer}
        </motion.div>
      </div>

      {/* Game state: waiting / active / exploded / finished */}
      {phase === "waiting" && (
        <div className="flex flex-col items-center gap-4 flex-1 justify-center">
          {gameNotFound && (
            <p className="font-pixel text-xs text-pixel-red mb-2">GAME NOT FOUND — ENTER A VALID CODE</p>
          )}

          <p className="font-pixel text-xs text-pixel-yellow mb-2">
            {players.length === 0 && !gameNotFound
              ? "CONNECT WALLET TO PLAY"
              : `WAITING FOR PLAYERS (${players.length}/${maxPlayers})`}
          </p>

          {!connected && (
            <p className="font-pixel text-[8px] text-pixel-grey">CONNECT YOUR WALLET ABOVE</p>
          )}

          {connected && !hasJoined && players.length < maxPlayers && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={joinGame}
              className="pixel-border-green bg-pixel-green px-8 py-4 font-pixel text-xs text-pixel-black pixel-btn cursor-pointer"
            >
              JOIN GAME
            </motion.button>
          )}

          {connected && hasJoined && isAuthority && players.length >= 2 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startRound}
              className="pixel-border-red bg-pixel-red px-8 py-4 font-pixel text-xs text-pixel-white pixel-btn cursor-pointer"
            >
              START ROUND
            </motion.button>
          )}

          {connected && hasJoined && !isAuthority && (
            <p className="font-pixel text-[10px] text-pixel-grey">
              WAITING FOR HOST TO START...
            </p>
          )}

          {/* Player roster */}
          {players.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {players.map((p) => (
                <div key={p.id} className="pixel-border-sm bg-pixel-dark px-3 py-2 font-pixel text-[8px] text-pixel-white">
                  {p.name} {p.wallet === wallet ? "(YOU)" : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === "active" && (
        <div className="flex-1 flex flex-col justify-center">
          <p className="font-pixel text-[10px] text-pixel-grey text-center mb-4">
            HOLDER: {players[currentHolder].name}
          </p>

          {/* Player Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {players.map((player) => (
              <motion.div
                key={player.id}
                animate={isHolding(player.id) ? {
                  scale: [1, 1.05, 1],
                  transition: { repeat: Infinity, duration: 0.5 },
                } : {}}
                className={`pixel-border p-3 sm:p-4 text-center relative ${
                  isHolding(player.id) ? "border-pixel-red" : ""
                }`}
              >
                {/* Bomb indicator on holder */}
                {isHolding(player.id) && (
                  <motion.div
                    className="absolute -top-3 -right-3 text-2xl"
                    animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                  >
                    💣
                  </motion.div>
                )}

                {/* Avatar */}
                <div className="text-3xl sm:text-4xl mb-2">
                  {["🔥", "🦍", "🧊", "🤡"][player.id]}
                </div>

                {/* Name */}
                <p className="font-pixel text-[8px] sm:text-[10px] text-pixel-white mb-1">
                  {player.name}
                </p>

                {/* Health bar (margin ratio visual) */}
                <div className="health-bar-bg h-3 w-full rounded-sm overflow-hidden border border-pixel-grey mb-2">
                  <motion.div
                    className={`h-full ${isHolding(player.id) ? "bg-pixel-red" : "bg-pixel-green"}`}
                    animate={{ width: isHolding(player.id) ? `${Math.max(10, 100 - (30 - timer) * 3)}%` : "100%" }}
                  />
                </div>

                {/* Score */}
                <p className="font-pixel text-[8px] text-pixel-yellow">
                  {player.score} PT
                </p>

                {/* Pass button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => passPotato(player.id)}
                  disabled={!isHolding(currentHolder) || player.id === currentHolder}
                  className={`mt-2 w-full py-2 font-pixel text-[8px] pixel-btn cursor-pointer ${
                    isHolding(currentHolder) && player.id !== currentHolder
                      ? "pixel-border bg-pixel-orange text-pixel-white"
                      : "pixel-border bg-pixel-grey text-pixel-grey cursor-not-allowed"
                  }`}
                >
                  {player.id === currentHolder ? "YOU" : "PASS →"}
                </motion.button>
              </motion.div>
            ))}
          </div>

          {/* Position info */}
          <div className="text-center font-pixel text-[8px] text-pixel-grey">
            <p>VIRTUAL POSITION: 100x SOL LONG | ENTRY: $145.50</p>
          </div>
        </div>
      )}

      {/* Explosion screen */}
      <AnimatePresence>
        {showExplosion && explodedPlayer !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-pixel-black/90"
          >
            <motion.div
              animate={{ scale: [1, 1.5, 0.8, 1.2, 1] }}
              transition={{ duration: 0.6 }}
              className="text-8xl mb-4"
            >
              💥
            </motion.div>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="font-pixel text-2xl text-pixel-red mb-2"
            >
              {players[explodedPlayer].name} LIQUIDATED!
            </motion.p>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="font-pixel text-xs text-pixel-grey"
            >
              -1 POINT
            </motion.p>
            {isAuthority && (
              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={endRound}
                className="mt-4 pixel-border bg-pixel-blue px-6 py-3 font-pixel text-xs text-pixel-white pixel-btn cursor-pointer"
              >
                END ROUND
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Finished state */}
      <AnimatePresence>
        {phase === "finished" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-pixel-black/90"
          >
            <p className="font-pixel text-3xl text-pixel-yellow mb-4">GAME OVER</p>
            <div className="pixel-border bg-pixel-dark p-6 w-full max-w-sm">
              {players.map((p, i) => (
                <div key={p.id} className="flex justify-between font-pixel text-xs mb-2">
                  <span className={i === 0 ? "text-pixel-yellow" : "text-pixel-white"}>
                    {i + 1}. {p.name}
                  </span>
                  <span className="text-pixel-green">{p.score} PT</span>
                </div>
              ))}
            </div>
            {isAuthority && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={commitAndPayout}
                className="mt-4 pixel-border bg-pixel-green px-6 py-3 font-pixel text-xs text-pixel-black pixel-btn cursor-pointer"
              >
                COMMIT & PAYOUT
              </motion.button>
            )}
            <a
              href="/"
              className="mt-4 pixel-border bg-pixel-blue px-6 py-3 font-pixel text-xs text-pixel-white pixel-btn inline-block"
            >
              BACK TO LOBBY
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game code + wallet display */}
      <div className="flex justify-between font-pixel text-[8px] text-pixel-grey mt-4">
        <span>GAME: {authority.slice(0, 8)}... #{gameCode}</span>
        <span>{connected ? wallet?.slice(0, 8) + "..." : "DISCONNECTED"}</span>
      </div>
    </div>
  );
}
