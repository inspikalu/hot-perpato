"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallet } from "./useWallet";
import { initSession, buildOpenPositionTx, sendFlashTradeTransaction, confirmFlashTradeTransaction } from "@/lib/flash";
import { VersionedTransaction } from "@solana/web3.js";

export type SideBet = {
  active: boolean;
  tradeType: "LONG" | "SHORT";
  entryPrice: number;
  currentPnl: number;
  leverage: number;
  sessionKey: string | null;
  signature: string | null;
};

export function useFlashSession(solPrice: number) {
  const { publicKey, wallet } = useWallet();
  const [sideBet, setSideBet] = useState<SideBet>({
    active: false,
    tradeType: "LONG",
    entryPrice: 0,
    currentPnl: 0,
    leverage: 100,
    sessionKey: null,
    signature: null,
  });

  const [loading, setLoading] = useState(false);
  const [pendingSessionTx, setPendingSessionTx] = useState<string | null>(null);
  const [pendingSessionType, setPendingSessionType] = useState<"LONG" | "SHORT" | null>(null);

  const initSideBet = useCallback(async (tradeType: "LONG" | "SHORT") => {
    if (!publicKey || loading) return;
    setLoading(true);
    try {
      const txBase64 = await initSession(publicKey.toBase58());
      setPendingSessionTx(txBase64);
      setPendingSessionType(tradeType);
      // Don't set sideBet yet - wait for user to sign
    } catch (e) {
      console.error("Session init failed", e);
    } finally {
      setLoading(false);
    }
  }, [publicKey, solPrice, loading]);

  const signAndSendSessionTx = useCallback(async () => {
    if (!pendingSessionTx || !wallet?.adapter || !publicKey) return;
    const adapter = wallet.adapter as any;
    if (!adapter.signTransaction) return;
    setLoading(true);
    try {
      const tx = VersionedTransaction.deserialize(Buffer.from(pendingSessionTx, "base64"));
      const signed = await adapter.signTransaction(tx);
      const signature = await sendFlashTradeTransaction(Buffer.from(signed.serialize()).toString("base64"));
      await confirmFlashTradeTransaction(signature);
      
      if (pendingSessionType) {
        setSideBet({
          active: false,
          tradeType: pendingSessionType,
          entryPrice: solPrice,
          currentPnl: 0,
          leverage: 100,
          sessionKey: pendingSessionTx,
          signature,
        });
      }
      setPendingSessionTx(null);
      setPendingSessionType(null);
    } catch (e) {
      console.error("Session sign/send failed", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [pendingSessionTx, pendingSessionType, wallet, publicKey, solPrice]);

  const executeSideBet = useCallback(async (amount: string, leverage: number, tradeType: "LONG" | "SHORT") => {
    if (!publicKey || loading) return;
    setLoading(true);
    try {
      const txBase64 = await buildOpenPositionTx(
        publicKey.toBase58(),
        amount,
        leverage,
        tradeType
      );
      
      // Send to Flash Trade ER RPC
      const signature = await sendFlashTradeTransaction(txBase64);
      await confirmFlashTradeTransaction(signature);
      
      setSideBet((prev) => ({
        ...prev,
        active: true,
        entryPrice: solPrice,
        leverage,
        signature,
      }));
      return signature;
    } catch (e) {
      console.error("Open position failed", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [publicKey, solPrice, loading]);

  // Update PnL
  useEffect(() => {
    if (!sideBet.active || sideBet.entryPrice === 0) return;
    const diff = sideBet.tradeType === "LONG"
      ? (solPrice - sideBet.entryPrice) / sideBet.entryPrice
      : (sideBet.entryPrice - solPrice) / sideBet.entryPrice;
    setSideBet((prev) => ({ ...prev, currentPnl: diff * 100 * prev.leverage }));
  }, [solPrice, sideBet.active, sideBet.entryPrice, sideBet.leverage, sideBet.tradeType]);

  return {
    sideBet,
    loading,
    initSideBet,
    signAndSendSessionTx,
    executeSideBet,
    pendingSessionTx,
    pendingSessionType,
  };
}
