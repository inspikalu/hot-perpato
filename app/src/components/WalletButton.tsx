"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export function WalletButton() {
  const { publicKey, connected, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  if (connected && publicKey) {
    const addr = `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <span className="font-pixel text-[8px] sm:text-[10px] text-pixel-green">
          {addr}
        </span>
        <button
          onClick={disconnect}
          className="pixel-border bg-pixel-light px-3 py-1.5 font-pixel text-[8px] text-pixel-white pixel-btn cursor-pointer"
        >
          EXIT
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      disabled={connecting}
      className="pixel-border bg-pixel-blue px-3 py-1.5 font-pixel text-[8px] text-pixel-white pixel-btn cursor-pointer disabled:opacity-40"
    >
      {connecting ? "..." : "CONNECT"}
    </button>
  );
}
