"use client";

import { AnchorProvider, Program, web3, BN } from "@anchor-lang/core";
import { Connection, SendTransactionError } from "@solana/web3.js";
import { useMemo } from "react";
import type { HotPerp } from "./idl/hot_perp";
import idl from "./idl/hot_perp.json";
import {
  SOLANA_DEVNET_RPC,
  MAGIC_ROUTER_RPC,
  PROGRAM_ID,
  DELEGATION_PROGRAM_ID,
  getDelegationBufferPda,
  getDelegationRecordPda,
  getDelegationMetadataPda,
} from "./magicblock";

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

async function sendRawTx(
  connection: Connection,
  raw: Buffer | Uint8Array,
  opts: any,
): Promise<string> {
  const sendOpts = opts
    ? {
        skipPreflight: opts.skipPreflight,
        preflightCommitment: opts.preflightCommitment || opts.commitment,
        maxRetries: opts.maxRetries,
        minContextSlot: opts.minContextSlot,
      }
    : {};
  const sig = await connection.sendRawTransaction(raw, sendOpts);
  const status = opts?.blockhash
    ? (await connection.confirmTransaction({ signature: sig, ...opts.blockhash }, opts.commitment)).value
    : (await connection.confirmTransaction(sig, opts?.commitment)).value;
  if (status.err) {
    const failedTx = await connection.getTransaction(sig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    const logs = failedTx?.meta?.logMessages ?? undefined;
    throw new SendTransactionError({
      action: "send",
      signature: sig,
      transactionMessage: logs
        ? `Transaction failed`
        : `Status: ${JSON.stringify(status)}`,
      logs,
    });
  }
  return sig;
}

function makeProvider(
  connection: web3.Connection,
  anchorWallet: any,
): AnchorProvider {
  const provider = new AnchorProvider(connection, anchorWallet, {
    commitment: "confirmed",
    skipPreflight: true,
  });
  provider.sendAndConfirm = async (tx: any, signers: any[], opts: any) => {
    if (opts === undefined) opts = provider.opts;
    tx.feePayer ??= provider.wallet!.publicKey;
    if (!tx.recentBlockhash || tx.recentBlockhash === "11111111111111111111111111111111") {
      tx.recentBlockhash = (await connection.getLatestBlockhash(opts.preflightCommitment)).blockhash;
    }
    if (signers) for (const s of signers) tx.partialSign(s);
    tx = await provider.wallet!.signTransaction(tx);
    return await sendRawTx(connection, tx.serialize(), opts);
  };
  return provider;
}

export function useProgram(
  solWallet: any,
): Program<HotPerp> | null {
  return useMemo(() => {
    const anchorWallet = makeAnchorWallet(solWallet);
    if (!anchorWallet) return null;
    const connection = new web3.Connection(SOLANA_DEVNET_RPC);
    const provider = makeProvider(connection, anchorWallet as any);
    return new Program<HotPerp>(idl as HotPerp, provider as any);
  }, [solWallet?.wallet?.adapter?.publicKey?.toBase58()]);
}

import { ER_DEVNET_RPC } from "./magicblock";

export function useErProgram(
  solWallet: any,
): Program<HotPerp> | null {
  return useMemo(() => {
    const anchorWallet = makeAnchorWallet(solWallet);
    if (!anchorWallet) return null;
    const connection = new web3.Connection(MAGIC_ROUTER_RPC);
    const provider = makeProvider(connection, anchorWallet as any);
    return new Program<HotPerp>(idl as HotPerp, provider as any);
  }, [solWallet?.wallet?.adapter?.publicKey?.toBase58()]);
}

// Read-only program connected to ER validator (for fetching delegated account state)
// Magic Router doesn't forward getAccountInfo for delegated accounts
let _erReadProgram: Program<HotPerp> | null = null;
export function getErReadProgram(): Program<HotPerp> {
  if (!_erReadProgram) {
    const connection = new web3.Connection(ER_DEVNET_RPC);
    // Read-only: no wallet needed, just for account.fetch()
    const dummyWallet = {
      publicKey: web3.PublicKey.default,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };
    const provider = new AnchorProvider(connection, dummyWallet as any, { commitment: "confirmed" });
    _erReadProgram = new Program<HotPerp>(idl as HotPerp, provider as any);
  }
  return _erReadProgram;
}

export async function delegateGame(
  program: Program<HotPerp>,
  gamePda: web3.PublicKey,
  walletPubkey: web3.PublicKey,
) {
  const bufferGame = getDelegationBufferPda(gamePda);
  const delegationRecordGame = getDelegationRecordPda(gamePda);
  const delegationMetadataGame = getDelegationMetadataPda(gamePda);

  await (program.methods as any)
    .delegateGame()
    .accounts({
      payer: walletPubkey,
      game: gamePda,
      bufferGame,
      delegationRecordGame,
      delegationMetadataGame,
      ownerProgram: PROGRAM_ID,
      delegationProgram: DELEGATION_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();
}

export function gamePda(authority: web3.PublicKey, gameId: number): [web3.PublicKey, number] {
  const gameIdBuf = new BN(gameId).toArrayLike(Buffer, "le", 8);
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("hot_perp_game"), authority.toBuffer(), gameIdBuf],
    PROGRAM_ID,
  );
}
