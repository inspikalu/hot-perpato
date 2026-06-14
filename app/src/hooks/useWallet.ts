"use client";

import { useWallet as useSolWallet } from "@solana/wallet-adapter-react";

export function useWallet() {
  const ctx = useSolWallet();

  return {
    publicKey: ctx.publicKey,
    connected: ctx.connected,
    connect: ctx.connect,
    disconnect: ctx.disconnect,
    select: ctx.select,
    wallets: ctx.wallets,
    connecting: ctx.connecting,
    wallet: ctx.wallet,
    shortAddress: ctx.publicKey
      ? `${ctx.publicKey.toBase58().slice(0, 4)}...${ctx.publicKey.toBase58().slice(-4)}`
      : null,
  };
}
