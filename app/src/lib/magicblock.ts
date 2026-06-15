import { Connection, PublicKey } from "@solana/web3.js";
import {
  ConnectionMagicRouter,
  DELEGATION_PROGRAM_ID,
  MAGIC_PROGRAM_ID,
  MAGIC_CONTEXT_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  delegateBufferPdaFromDelegatedAccountAndOwnerProgram,
  delegationRecordPdaFromDelegatedAccount,
  delegationMetadataPdaFromDelegatedAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";

// Magic Router auto-routes between base layer and Ephemeral Rollup
export const MAGIC_ROUTER_RPC = "https://devnet-router.magicblock.app";
export const MAGIC_ROUTER_WS = "wss://devnet-router.magicblock.app";
export const ER_DEVNET_RPC = "https://devnet-as.magicblock.app";
export const ER_DEVNET_WS = "wss://devnet-as.magicblock.app";
export const SOLANA_DEVNET_RPC = "https://api.devnet.solana.com";
export const ER_VALIDATOR = new PublicKey("MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57");
export const PROGRAM_ID = new PublicKey("9y5B6n8Lq8HipGsuwE7TrTW31y8T49xtFrZstYJeEV5w");
export const GAME_SEED = "hot_perp_game";
export const ESCROW_SEED = "hot_perp_escrow";
export const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export { DELEGATION_PROGRAM_ID, MAGIC_PROGRAM_ID, MAGIC_CONTEXT_ID };

export function getMagicRouterConnection(): Connection {
  return new Connection(MAGIC_ROUTER_RPC, { wsEndpoint: MAGIC_ROUTER_WS });
}

export function getMagicRouter(): ConnectionMagicRouter {
  return new ConnectionMagicRouter(MAGIC_ROUTER_RPC);
}

// Direct connection to ER validator for reading delegated account state
// Magic Router doesn't forward getAccountInfo for delegated accounts
export function getErValidatorConnection(): Connection {
  return new Connection(ER_DEVNET_RPC, { wsEndpoint: ER_DEVNET_WS });
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

export function getDelegationBufferPda(game: PublicKey): PublicKey {
  return delegateBufferPdaFromDelegatedAccountAndOwnerProgram(game, PROGRAM_ID);
}

export function getDelegationRecordPda(game: PublicKey): PublicKey {
  return delegationRecordPdaFromDelegatedAccount(game);
}

export function getDelegationMetadataPda(game: PublicKey): PublicKey {
  return delegationMetadataPdaFromDelegatedAccount(game);
}
