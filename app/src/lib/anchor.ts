"use client";

import { AnchorProvider, Program, web3, BN } from "@anchor-lang/core";
import { useMemo } from "react";
import type { HotPerp } from "./idl/hot_perp";
import idl from "./idl/hot_perp.json";
import { SOLANA_DEVNET_RPC, PROGRAM_ID } from "./magicblock";

export { BN } from "@anchor-lang/core";

function makeAnchorWallet(solWallet: any) {
  const adapter = solWallet?.wallet?.adapter;
  if (!adapter?.publicKey) return null;
  return {
    publicKey: adapter.publicKey,
    signTransaction: async (tx: any) => {
      if (adapter.signTransaction) return adapter.signTransaction(tx);
      return tx;
    },
    signAllTransactions: async (txs: any[]) => {
      if (adapter.signAllTransactions) return adapter.signAllTransactions(txs);
      return txs;
    },
  };
}

export function useProgram(
  solWallet: any,
): Program<HotPerp> | null {
  return useMemo(() => {
    const anchorWallet = makeAnchorWallet(solWallet);
    if (!anchorWallet) return null;
    const connection = new web3.Connection(SOLANA_DEVNET_RPC);
    const provider = new AnchorProvider(connection, anchorWallet as any, {
      commitment: "confirmed",
    });
    return new Program<HotPerp>(idl as HotPerp, provider as any);
  }, [solWallet?.wallet?.adapter?.publicKey?.toBase58()]);
}

export function gamePda(authority: web3.PublicKey, gameId: number): [web3.PublicKey, number] {
  const gameIdBuf = new BN(gameId).toArrayLike(Buffer, "le", 8);
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("hot_perp_game"), authority.toBuffer(), gameIdBuf],
    PROGRAM_ID,
  );
}
