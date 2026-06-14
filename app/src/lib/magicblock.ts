import { Connection, PublicKey } from "@solana/web3.js";

// Magic Router auto-routes between base layer and Ephemeral Rollup
export const MAGIC_ROUTER_RPC = "https://devnet-router.magicblock.app";
export const MAGIC_ROUTER_WS = "wss://devnet-router.magicblock.app";
export const ER_DEVNET_RPC = "https://devnet-as.magicblock.app";
export const ER_DEVNET_WS = "wss://devnet-as.magicblock.app";
export const SOLANA_DEVNET_RPC = "https://devnet-router.magicblock.app";
export const ER_VALIDATOR = new PublicKey("MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57");
export const PROGRAM_ID = new PublicKey("9y5B6n8Lq8HipGsuwE7TrTW31y8T49xtFrZstYJeEV5w");
export const GAME_SEED = "hot_perp_game";
export const ESCROW_SEED = "hot_perp_escrow";

export function getMagicRouterConnection(): Connection {
  return new Connection(MAGIC_ROUTER_RPC, { wsEndpoint: MAGIC_ROUTER_WS });
}

export function getDevnetConnection(): Connection {
  return new Connection(SOLANA_DEVNET_RPC);
}

export function deriveGamePda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(GAME_SEED), authority.toBuffer()],
    PROGRAM_ID
  );
}

export function deriveEscrowPda(game: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_SEED), game.toBuffer()],
    PROGRAM_ID
  );
}
