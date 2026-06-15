const FLASH_API = "https://flashapi.trade/v2";
const FLASH_ER_RPC = "https://flashtrade.magicblock.app";

export async function fetchSolPrice(): Promise<number> {
  const res = await fetch(`${FLASH_API}/prices/SOL`);
  const data = await res.json();
  return data.price;
}

export async function initSession(owner: string): Promise<string> {
  const res = await fetch(`${FLASH_API}/session/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner }),
  });
  const { transactionBase64 } = await res.json();
  return transactionBase64;
}

export async function buildOpenPositionTx(
  owner: string,
  amount: string,
  leverage: number,
  tradeType: "LONG" | "SHORT"
): Promise<string> {
  const res = await fetch(`${FLASH_API}/transaction-builder/open-position`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inputTokenSymbol: "USDC",
      outputTokenSymbol: "SOL",
      inputAmountUi: amount,
      leverage,
      tradeType,
      owner,
      slippagePercentage: "0.5",
    }),
  });
  const { transactionBase64 } = await res.json();
  return transactionBase64;
}

export async function sendFlashTradeTransaction(txBase64: string): Promise<string> {
  const res = await fetch(FLASH_ER_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [
        txBase64,
        { encoding: "base64", skipPreflight: true, maxRetries: 3 },
      ],
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || "Flash Trade transaction failed");
  }
  return data.result;
}

export async function confirmFlashTradeTransaction(signature: string): Promise<void> {
  const res = await fetch(FLASH_ER_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "confirmTransaction",
      params: [signature, { commitment: "confirmed" }],
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || "Confirmation failed");
  }
  if (data.result?.value?.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(data.result.value.err)}`);
  }
}
