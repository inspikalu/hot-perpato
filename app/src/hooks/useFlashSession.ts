"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallet } from "./useWallet";
import { initSession, buildOpenPositionTx } from "@/lib/flash";

export type SideBet = {
  active: boolean;
  tradeType: "LONG" | "SHORT";
  entryPrice: number;
  currentPnl: number;
  leverage: number;
  sessionKey: string | null;
};

export function useFlashSession(solPrice: number) {
  const { publicKey } = useWallet();
  const [sideBet, setSideBet] = useState<SideBet>({
    active: false,
    tradeType: "LONG",
    entryPrice: 0,
    currentPnl: 0,
    leverage: 100,
    sessionKey: null,
  });

  const [loading, setLoading] = useState(false);

  const initSideBet = useCallback(async (tradeType: "LONG" | "SHORT") => {
    if (!publicKey || loading) return;
    setLoading(true);
    try {
      const txBase64 = await initSession(publicKey.toBase58());
      setSideBet({
        active: false,
        tradeType,
        entryPrice: solPrice,
        currentPnl: 0,
        leverage: 100,
        sessionKey: txBase64,
      });
    } catch (e) {
      console.error("Session init failed", e);
    } finally {
      setLoading(false);
    }
  }, [publicKey, solPrice, loading]);

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
      setSideBet((prev) => ({
        ...prev,
        active: true,
        entryPrice: solPrice,
        leverage,
      }));
      return txBase64;
    } catch (e) {
      console.error("Open position failed", e);
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
    executeSideBet,
  };
}
