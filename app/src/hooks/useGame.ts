"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { web3 } from "@anchor-lang/core";
import { useWallet } from "./useWallet";
import { useProgram, gamePda } from "@/lib/anchor";

export type Player = {
  id: number;
  name: string;
  wallet: string;
  score: number;
  passes: number;
  roundsSurvived: number;
  liquidationsCaused: number;
  alive: boolean;
};

export type GamePhase = "waiting" | "active" | "exploded" | "finished";

const POLL_MS = 2000;
const MOCK_NAMES = ["ALPHA", "BEAST", "CHILL", "DEGEN"];

function onChainPhase(phase: any): GamePhase {
  if (phase.waiting !== undefined) return "waiting";
  if (phase.active !== undefined) return "active";
  if (phase.exploded !== undefined) return "exploded";
  if (phase.finished !== undefined) return "finished";
  return "waiting";
}

function nameForIndex(i: number, wallet: string): string {
  if (i < MOCK_NAMES.length) return MOCK_NAMES[i];
  return wallet.slice(0, 4).toUpperCase();
}

export function useGame(gameId: string) {
  const solWallet = useWallet();
  const program = useProgram(solWallet);
  const walletStr = solWallet?.publicKey?.toBase58() ?? null;

  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState<GamePhase>("waiting");
  const [currentHolder, setCurrentHolder] = useState(0);
  const [timer, setTimer] = useState(30);
  const [round, setRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(7);
  const [solPrice, setSolPrice] = useState(145.5);
  const [showExplosion, setShowExplosion] = useState(false);
  const [explodedPlayer, setExplodedPlayer] = useState<number | null>(null);
  const [gameAddress, setGameAddress] = useState<string | null>(null);
  const [authority, setAuthority] = useState<string | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [gameNotFound, setGameNotFound] = useState(false);

  const authorityPubkeyRef = useRef<web3.PublicKey | null>(null);
  const gamePdaRef = useRef<web3.PublicKey | null>(null);
  const pollingRef = useRef(false);
  const prevPhaseRef = useRef<GamePhase>("waiting");
  const failCountRef = useRef(0);

  // Parse gameId as authority public key
  useEffect(() => {
    try {
      const pk = new web3.PublicKey(gameId);
      authorityPubkeyRef.current = pk;
      const [pda] = gamePda(pk);
      gamePdaRef.current = pda;
      setGameAddress(pda.toBase58());
      setAuthority(pk.toBase58());
    } catch {
      authorityPubkeyRef.current = null;
      gamePdaRef.current = null;
      setGameAddress(null);
      setAuthority(null);
    }
  }, [gameId]);

  // Poll on-chain game state
  useEffect(() => {
    if (!gamePdaRef.current || !program) return;
    const pda = gamePdaRef.current;
    const prog = program;
    let mounted = true;

    async function poll() {
      if (!mounted || pollingRef.current) return;
      pollingRef.current = true;
      try {
        const game = await (prog as any).account.game.fetch(pda);
        if (!mounted) return;

        const rawState = game.state;
        const newPhase = onChainPhase(rawState);
        const prevPhase = prevPhaseRef.current;
        prevPhaseRef.current = newPhase;
        if (newPhase === "exploded" && prevPhase === "active") {
          setExplodedPlayer(currentHolder);
        }
        setPhase(newPhase);
        setCurrentHolder(game.currentHolder);
        setRound(game.round);
        setTotalRounds(game.config.totalRounds);
        setMaxPlayers(game.config.maxPlayers);

        const mapped: Player[] = game.players.map((p: any, i: number) => ({
          id: i,
          name: nameForIndex(i, p.wallet.toBase58()),
          wallet: p.wallet.toBase58(),
          score: p.score,
          passes: p.passesMade,
          roundsSurvived: p.roundsSurvived,
          liquidationsCaused: p.liquidationsCaused,
          alive: true,
        }));
        setPlayers(mapped);

        failCountRef.current = 0;
        setGameNotFound(false);

        // Timer from deadline
        if (onChainPhase(rawState) === "active") {
          const deadline = game.timerDeadline.toNumber();
          const remaining = Math.max(0, deadline - Math.floor(Date.now() / 1000));
          setTimer(remaining);
        }
      } catch (err) {
        failCountRef.current++;
        if (failCountRef.current >= 3) setGameNotFound(true);
      }
      pollingRef.current = false;
      if (mounted) setTimeout(poll, POLL_MS);
    }

    poll();
    return () => { mounted = false; };
  }, [program, gameId]);

  // Local countdown when active
  useEffect(() => {
    if (phase !== "active") return;
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, timer]);

  // Auto-explode when timer hits 0
  useEffect(() => {
    if (phase !== "active" || timer > 0 || !program || !gamePdaRef.current) return;
    let mounted = true;
    (async () => {
      try {
        await (program.methods as any)
          .explodePotato()
          .accounts({ game: gamePdaRef.current! })
          .rpc();
      } catch {
        // Maybe already exploded or timer not yet expired on-chain
      }
    })();
    return () => { mounted = false; };
  }, [phase, timer, program]);

  // Poll SOL price
  useEffect(() => {
    let mounted = true;
    async function poll() {
      try {
        const res = await fetch("https://flashapi.trade/v2/prices/SOL");
        const data = await res.json();
        if (mounted) setSolPrice(data.price);
      } catch {}
      if (mounted) setTimeout(poll, 3000);
    }
    poll();
    return () => { mounted = false; };
  }, []);

  const positionPnl = ((solPrice - 145.5) / 145.5) * 100 * 100;

  const connected = solWallet?.connected ?? false;
  const hasJoined = connected && players.some((p) => p.wallet === walletStr);
  const isAuthority = connected && authority === walletStr;

  const isHolding = (playerId: number) =>
    phase === "active" && currentHolder === playerId;

  const myPubkey = solWallet?.wallet?.adapter?.publicKey ?? null;

  const joinGame = useCallback(async () => {
    if (!program || !gamePdaRef.current || !myPubkey) return;
    try {
      await (program.methods as any)
        .joinGame()
        .accounts({
          game: gamePdaRef.current,
          player: myPubkey,
        })
        .rpc();
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("AlreadyJoined") || msg.includes("already in game")) {
        // Already joined, ignore
      } else if (msg.includes("AccountNotInitialized") || msg.includes("not initialized") || msg.includes("3012")) {
        console.warn("Game not yet created on-chain. Ensure the host has created the game.");
      } else {
        console.error("joinGame failed:", err);
      }
    }
  }, [program, myPubkey]);

  const startRound = useCallback(async () => {
    if (!program || !gamePdaRef.current || !myPubkey) return;
    try {
      await (program.methods as any)
        .startRound()
        .accounts({
          game: gamePdaRef.current,
          authority: myPubkey,
        })
        .rpc();
    } catch (err) {
      console.error("startRound failed:", err);
    }
  }, [program, myPubkey]);

  const passPotato = useCallback(
    async (toId: number) => {
      if (!program || !gamePdaRef.current || !myPubkey) return;
      try {
        await (program.methods as any)
          .passPotato(toId)
          .accounts({
            game: gamePdaRef.current,
            player: myPubkey,
          })
          .rpc();
      } catch (err) {
        console.error("passPotato failed:", err);
      }
    },
    [program, myPubkey],
  );

  // Watch for explosion events to show animation
  useEffect(() => {
    if (phase !== "exploded") return;
    setShowExplosion(true);
    const timeout = setTimeout(() => {
      setShowExplosion(false);
    }, 2500);
    return () => clearTimeout(timeout);
  }, [phase]);

  return {
    phase,
    currentHolder,
    timer,
    round,
    totalRounds,
    maxPlayers,
    players,
    solPrice,
    positionPnl,
    showExplosion,
    explodedPlayer,
    isHolding,
    isAuthority,
    hasJoined, gameNotFound,
    joinGame,
    startRound,
    passPotato,
    connected,
    wallet: walletStr,
    gameAddress,
    authority,
  };
}
