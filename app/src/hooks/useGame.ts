"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { web3 } from "@anchor-lang/core";
import { useWallet } from "./useWallet";
import { useProgram, useErProgram, gamePda, getErReadProgram } from "@/lib/anchor";
import { BN } from "@/lib/anchor";
import { getMagicRouter, SOLANA_DEVNET_RPC, MAGIC_PROGRAM_ID, MAGIC_CONTEXT_ID, USDC_MINT, TOKEN_PROGRAM_ID, deriveEscrowPda, PROGRAM_ID } from "@/lib/magicblock";
import { Connection } from "@solana/web3.js";

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
const ER_MAX_RETRIES = 3;
const ER_RETRY_DELAY_MS = 3000;
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

// Send transaction via ER router (for Ephemeral Rollup instructions)
// Includes retry logic — Magic Router has intermittent ETIMEDOUT errors
async function sendViaRouter(
  method: any,
  wallet: any,
  erConn: ReturnType<typeof getMagicRouter>,
) {
  const adapter = wallet?.wallet?.adapter;
  if (!adapter?.signTransaction) throw new Error("Wallet does not support signing");

  let lastErr: any;
  for (let attempt = 0; attempt < ER_MAX_RETRIES; attempt++) {
    try {
      const tx = await method.transaction();
      tx.feePayer = adapter.publicKey;
      // Let Magic Router set the blockhash via getBlockhashForAccounts
      await erConn.prepareTransaction(tx);
      // Sign with wallet adapter
      const signed = await adapter.signTransaction(tx);
      // Send raw transaction
      const sig = await erConn.sendRawTransaction(signed.serialize());
      return sig;
    } catch (err: any) {
      lastErr = err;
      const msg = err?.message ?? "";
      if (msg.includes("fetch failed") || msg.includes("ETIMEDOUT") || msg.includes("Blockhash not found")) {
        console.warn(`ER tx attempt ${attempt + 1}/${ER_MAX_RETRIES} failed: ${msg.slice(0, 80)}`);
        if (attempt < ER_MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, ER_RETRY_DELAY_MS * (attempt + 1)));
          continue;
        }
      }
      throw err;
    }
  }
  throw lastErr;
}

// Send via L1 for base-layer instructions (create, join, delegate)
async function sendViaL1(
  method: any,
  wallet: any,
  connection: Connection,
) {
  const adapter = wallet?.wallet?.adapter;
  if (!adapter?.signTransaction) throw new Error("Wallet does not support signing");
  const tx = await method.transaction();
  tx.feePayer = adapter.publicKey;
  const bh = await connection.getLatestBlockhash();
  tx.recentBlockhash = bh.blockhash;
  tx.lastValidBlockHeight = bh.lastValidBlockHeight;
  const signed = await adapter.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction({
    signature: sig,
    blockhash: bh.blockhash,
    lastValidBlockHeight: bh.lastValidBlockHeight,
  });
  return sig;
}

export function useGame(gameId: string) {
  const solWallet = useWallet();
  const program = useProgram(solWallet);
  const erProgram = useErProgram(solWallet);
  const walletStr = solWallet?.publicKey?.toBase58() ?? null;

  const [authorityStr, gameCodeStr] = gameId.split(/[:/]/);
  const gameCode = parseInt(gameCodeStr || "0", 10) || 0;

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
  const erConnRef = useRef(getMagicRouter());
  const l1ConnRef = useRef(new Connection(SOLANA_DEVNET_RPC, "confirmed"));
  const programRef = useRef(program);
  const erProgramRef = useRef(erProgram);

  programRef.current = program;
  erProgramRef.current = erProgram;

  useEffect(() => {
    try {
      const pk = new web3.PublicKey(authorityStr);
      authorityPubkeyRef.current = pk;
      const [pda] = gamePda(pk, gameCode);
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

  useEffect(() => {
    if (!gamePdaRef.current) return;
    const pda = gamePdaRef.current;
    let mounted = true;

    async function poll() {
      if (!mounted || pollingRef.current) return;
      pollingRef.current = true;
      try {
        // Try ER validator first (for delegated accounts), fall back to L1
        let game: any;
        try {
          const erRead = getErReadProgram();
          game = await erRead.account.game.fetch(pda);
        } catch {
          // ER read failed — retry once before falling back to L1
          try {
            await new Promise((r) => setTimeout(r, 1000));
            const erRead = getErReadProgram();
            game = await erRead.account.game.fetch(pda);
          } catch {
            // Not delegated yet or ER unavailable, read from L1
            const prog = programRef.current;
            if (!prog) throw new Error("No program available");
            game = await (prog as any).account.game.fetch(pda);
          }
        }
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
  }, []);

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
    if (phase !== "active" || timer > 0 || !erProgramRef.current || !gamePdaRef.current) return;
    let mounted = true;
    (async () => {
      try {
        await sendViaRouter(
          (erProgramRef.current!.methods as any).explodePotato().accounts({ game: gamePdaRef.current! }),
          solWallet,
          erConnRef.current,
        );
      } catch {
        // Maybe already exploded or timer not yet expired on-chain
      }
    })();
    return () => { mounted = false; };
  }, [phase, timer, solWallet]);

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
  const isAuthority = connected && authority === walletStr && authorityStr === walletStr;

  const isHolding = (playerId: number) =>
    phase === "active" && currentHolder === playerId;

  const myPubkey = solWallet?.wallet?.adapter?.publicKey ?? null;

  const joinGame = useCallback(async () => {
    if (!programRef.current || !gamePdaRef.current || !myPubkey) return;
    try {
      await sendViaL1(
        (programRef.current.methods as any).joinGame().accounts({
          game: gamePdaRef.current,
          player: myPubkey,
        }),
        solWallet,
        l1ConnRef.current,
      );
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("AlreadyJoined") || msg.includes("already in game")) {
      } else if (msg.includes("AccountNotInitialized") || msg.includes("not initialized") || msg.includes("3012")) {
        console.warn("Game not yet created on-chain.");
      } else {
        console.error("joinGame failed:", err);
      }
    }
  }, [myPubkey, solWallet]);

  const startRound = useCallback(async () => {
    if (!erProgramRef.current || !gamePdaRef.current || !myPubkey) return;
    try {
      await sendViaRouter(
        (erProgramRef.current.methods as any).startRound().accounts({
          game: gamePdaRef.current,
          authority: myPubkey,
        }),
        solWallet,
        erConnRef.current,
      );
    } catch (err) {
      console.error("startRound failed:", err);
    }
  }, [myPubkey, solWallet]);

  const passPotato = useCallback(
    async (toId: number) => {
      if (!erProgramRef.current || !gamePdaRef.current || !myPubkey) return;
      try {
        await sendViaRouter(
          (erProgramRef.current.methods as any).passPotato(toId).accounts({
            game: gamePdaRef.current,
            player: myPubkey,
          }),
          solWallet,
          erConnRef.current,
        );
      } catch (err) {
        console.error("passPotato failed:", err);
      }
    },
    [myPubkey, solWallet],
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

  const endRound = useCallback(async () => {
    if (!erProgramRef.current || !gamePdaRef.current || !myPubkey) return;
    try {
      await sendViaRouter(
        (erProgramRef.current.methods as any).endRound().accounts({
          game: gamePdaRef.current,
          authority: myPubkey,
        }),
        solWallet,
        erConnRef.current,
      );
    } catch (err) {
      console.error("endRound failed:", err);
    }
  }, [myPubkey, solWallet]);

  const commitAndPayout = useCallback(async () => {
    if (!erProgramRef.current || !programRef.current || !gamePdaRef.current || !myPubkey) return;
    try {
      // Find the winner (uses >= to match Rust's max_by_key tie-breaking)
      const winnerIdx = players.reduce((best, p, i) =>
        p.score >= players[best].score ? i : best, 0);
      const winnerWallet = new web3.PublicKey(players[winnerIdx].wallet);

      // Derive escrow PDA and winner USDC ATA
      const [escrowUsdc] = deriveEscrowPda(gamePdaRef.current);
      const winnerUsdc = web3.PublicKey.findProgramAddressSync(
        [winnerWallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), USDC_MINT.toBuffer()],
        new web3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
      )[0];

      // Step 1: commitState via ER (commits latest state to L1)
      await sendViaRouter(
        (erProgramRef.current!.methods as any).commitState().accounts({
          payer: myPubkey,
          game: gamePdaRef.current,
          magicProgram: MAGIC_PROGRAM_ID,
          magicContext: MAGIC_CONTEXT_ID,
        }),
        solWallet,
        erConnRef.current,
      );
      console.log("commitState sent via ER");

      // Wait for state to settle on L1 before payout
      await new Promise(r => setTimeout(r, 8000));

      // Step 2: payoutWinnerL1 on L1 (game account may still be delegated)
      const gameAuthority = new web3.PublicKey(authorityStr!);
      await sendViaL1(
        (programRef.current!.methods as any).payoutWinnerL1(winnerWallet, gameAuthority, new BN(gameCode)).accounts({
          game: gamePdaRef.current,
          escrowUsdc,
          winnerUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
        }),
        solWallet,
        l1ConnRef.current,
      );
      console.log("payoutWinnerL1 success");
    } catch (err) {
      console.error("commitAndPayout failed:", err);
    }
  }, [myPubkey, solWallet, players, authorityStr, gameCode]);

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
    endRound,
    commitAndPayout,
    connected,
    wallet: walletStr,
    gameAddress,
    authority,
  };
}
