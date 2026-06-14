const FLASH_API = "https://flashapi.trade/v2";

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
