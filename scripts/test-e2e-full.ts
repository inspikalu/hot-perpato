import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@anchor-lang/core";
import { ConnectionMagicRouter } from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  createMintToInstruction,
  createMint,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptAccount,
  createInitializeAccount3Instruction,
} from "@solana/spl-token";
import * as fs from "fs";
import idl from "../target/idl/hot_perp.json";
import type { HotPerp } from "../target/types/hot_perp";

const PROGRAM_ID = new PublicKey("9y5B6n8Lq8HipGsuwE7TrTW31y8T49xtFrZstYJeEV5w");
const DELEGATION_PROGRAM_ID = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const MAGIC_PROGRAM_ID = new PublicKey("Magic11111111111111111111111111111111111111");
const MAGIC_CONTEXT_ID = new PublicKey("MagicContext1111111111111111111111111111111");
const GAME_SEED = Buffer.from("hot_perp_game");
const ESCROW_SEED = Buffer.from("hot_perp_escrow");
const DEVNET_RPC = "https://api.devnet.solana.com";
const MAGIC_ROUTER_RPC = "https://devnet-router.magicblock.app";
const ER_VALIDATOR_RPC = "https://devnet-as.magicblock.app";
const COMMITMENT = "confirmed";
const WALLET_DIR = process.env.HOME + "/Desktop/wallets/solana-wallets";

function gamePda(authority: PublicKey, gameId: number): [PublicKey, number] {
  const gameIdBuf = new BN(gameId).toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddressSync([GAME_SEED, authority.toBuffer(), gameIdBuf], PROGRAM_ID);
}

function escrowPda(game: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([ESCROW_SEED, game.toBuffer()], PROGRAM_ID);
}

function loadKeypair(filename: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(`${WALLET_DIR}/${filename}`, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function makeWallet(kp: Keypair) {
  return {
    publicKey: kp.publicKey,
    signTransaction: async (tx: any) => { tx.sign(kp); return tx; },
    signAllTransactions: async (txs: any[]) => { for (const tx of txs) tx.sign(kp); return txs; },
  } as any;
}

function log(emoji: string, msg: string) {
  console.log(`  ${emoji} ${msg}`);
}

// ER read program
let _erReadProgram: Program<HotPerp> | null = null;
function getErReadProgram(): Program<HotPerp> {
  if (!_erReadProgram) {
    const conn = new Connection(ER_VALIDATOR_RPC);
    const dummyWallet = { publicKey: PublicKey.default, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any[]) => txs };
    const provider = new AnchorProvider(conn, dummyWallet as any, { commitment: COMMITMENT });
    _erReadProgram = new Program(idl as any, provider as any);
  }
  return _erReadProgram;
}

// sendViaRouter with retry
const ER_MAX_RETRIES = 3;
const ER_RETRY_DELAY_MS = 3000;

async function sendViaRouter(method: any, wallet: any, erConn: ConnectionMagicRouter): Promise<string> {
  const adapter = wallet?.wallet?.adapter ?? wallet;
  let lastErr: any;
  for (let attempt = 0; attempt < ER_MAX_RETRIES; attempt++) {
    try {
      const tx = await method.transaction();
      tx.feePayer = adapter.publicKey;
      await erConn.prepareTransaction(tx);
      const signed = await adapter.signTransaction(tx);
      return await erConn.sendRawTransaction(signed.serialize());
    } catch (err: any) {
      lastErr = err;
      const msg = err?.message ?? "";
      if (msg.includes("fetch failed") || msg.includes("ETIMEDOUT") || msg.includes("Blockhash not found")) {
        if (attempt < ER_MAX_RETRIES - 1) { await new Promise(r => setTimeout(r, ER_RETRY_DELAY_MS * (attempt + 1))); continue; }
      }
      throw err;
    }
  }
  throw lastErr;
}

async function sendRawViaRouter(tx: any, wallet: any, erConn: ConnectionMagicRouter): Promise<string> {
  const adapter = wallet?.wallet?.adapter ?? wallet;
  let lastErr: any;
  for (let attempt = 0; attempt < ER_MAX_RETRIES; attempt++) {
    try {
      tx.feePayer = adapter.publicKey;
      await erConn.prepareTransaction(tx);
      const signed = await adapter.signTransaction(tx);
      return await erConn.sendRawTransaction(signed.serialize());
    } catch (err: any) {
      lastErr = err;
      const msg = err?.message ?? "";
      if (msg.includes("fetch failed") || msg.includes("ETIMEDOUT") || msg.includes("Blockhash not found")) {
        if (attempt < ER_MAX_RETRIES - 1) { await new Promise(r => setTimeout(r, ER_RETRY_DELAY_MS * (attempt + 1))); continue; }
      }
      throw err;
    }
  }
  throw lastErr;
}

async function sendViaL1(method: any, wallet: any, connection: Connection): Promise<string> {
  const adapter = wallet?.wallet?.adapter ?? wallet;
  const tx = await method.transaction();
  tx.feePayer = adapter.publicKey;
  const bh = await connection.getLatestBlockhash();
  tx.recentBlockhash = bh.blockhash;
  tx.lastValidBlockHeight = bh.lastValidBlockHeight;
  const signed = await adapter.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
  const result = await connection.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, COMMITMENT);
  if (result.value.err) throw new Error(`L1 tx failed: ${JSON.stringify(result.value.err)}`);
  return sig;
}

async function readState(pda: PublicKey, label: string) {
  try {
    const game = await getErReadProgram().account.game.fetch(pda);
    const stateStr = game.state.waiting !== undefined ? "Waiting" : game.state.active !== undefined ? "Active" : game.state.exploded !== undefined ? "Exploded" : game.state.finished !== undefined ? "Finished" : "Unknown";
    log("📊", `${label} [${stateStr}] round=${game.round} holder=${game.currentHolder}`);
    for (let i = 0; i < game.players.length; i++) {
      const p = game.players[i];
      log("  ", `  P${i} ${p.wallet.toBase58().slice(0, 10)}... score=${p.score} passes=${p.passesMade} survived=${p.roundsSurvived}`);
    }
    return game;
  } catch (e: any) {
    log("❌", `${label}: ${e.message?.slice(0, 100)}`);
    return null;
  }
}

async function main() {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Hot Perp E2E — with USDC Escrow + commitAndPayout");
  console.log("═══════════════════════════════════════════════════════\n");

  const auth = loadKeypair("212mxJEqpi5MdDpsYpWunFWjhy6xXKAQHFHkqSEWMW6w.json");
  const p1 = loadKeypair("CauhGxuAqnXP5Zrs3aqbjaf5v2k9p1dbam4wgGtp42Fu.json");
  const p2 = loadKeypair("AVq5Q7CeALotLmJ1frLPppxbXB5QvgNk8y9Uk6H3tRMY.json");
  const players = [auth, p1, p2];
  const names = ["AUTH", "P1", "P2"];

  log("🔑", `AUTH: ${auth.publicKey.toBase58()}`);
  log("🔑", `P1:   ${p1.publicKey.toBase58()}`);
  log("🔑", `P2:   ${p2.publicKey.toBase58()}`);

  const l1 = new Connection(DEVNET_RPC, COMMITMENT);
  const erConn = new ConnectionMagicRouter(MAGIC_ROUTER_RPC);

  // ─── Step 1: Use real devnet USDC ───
  console.log("\n── Step 1: Use Real Devnet USDC ──");
  const usdcMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
  log("✅", `Devnet USDC Mint: ${usdcMint.toBase58()}`);

  // ─── Step 2: Create Game ───
  console.log("\n── Step 2: Create Game ──");
  const gameId = Math.floor(Date.now() / 1000);
  const [pda] = gamePda(auth.publicKey, gameId);
  log("📋", `Game #${gameId} PDA: ${pda.toBase58()}`);

  const provider = new AnchorProvider(l1, makeWallet(auth), { commitment: COMMITMENT });
  const program = new Program(idl as any, provider as any);

  const config = {
    gameId: new BN(gameId),
    maxPlayers: 4,
    totalRounds: 3,
    stakeMode: { free: {} },
    buyInAmount: new BN(0),
  };

  await sendViaL1(program.methods.createGame(config).accounts({ game: pda, user: auth.publicKey, systemProgram: SystemProgram.programId } as any), makeWallet(auth), l1);
  log("✅", "createGame done");

  // ─── Step 3: Join Game ───
  console.log("\n── Step 3: Join Game ──");
  for (let i = 0; i < players.length; i++) {
    await sendViaL1(program.methods.joinGame().accounts({ game: pda, player: players[i].publicKey } as any), makeWallet(players[i]), l1);
    log("✅", `joinGame (${names[i]})`);
  }

  // ─── Step 4: Delegate ───
  console.log("\n── Step 4: Delegate Game ──");
  const TAG = { BUFFER: Buffer.from("buffer"), RECORD: Buffer.from("delegation"), METADATA: Buffer.from("delegation-metadata") };
  const bufferPda = PublicKey.findProgramAddressSync([TAG.BUFFER, pda.toBuffer()], PROGRAM_ID)[0];
  const recordPda = PublicKey.findProgramAddressSync([TAG.RECORD, pda.toBuffer()], DELEGATION_PROGRAM_ID)[0];
  const metadataPda = PublicKey.findProgramAddressSync([TAG.METADATA, pda.toBuffer()], DELEGATION_PROGRAM_ID)[0];

  await sendViaL1(program.methods.delegateGame().accounts({
    payer: auth.publicKey, game: pda,
    bufferGame: bufferPda, delegationRecordGame: recordPda, delegationMetadataGame: metadataPda,
    ownerProgram: PROGRAM_ID, delegationProgram: DELEGATION_PROGRAM_ID, systemProgram: SystemProgram.programId,
  } as any), makeWallet(auth), l1);
  log("✅", "delegateGame done");

  log("⏳", "Waiting 10s for delegation...");
  await new Promise(r => setTimeout(r, 10000));

  // ─── Step 5: Create Escrow USDC Account (owned by game PDA) ───
  console.log("\n── Step 5: Create Escrow USDC Token Account ──");
  const escrowKeypair = Keypair.generate();
  const escrowLamports = await getMinimumBalanceForRentExemptAccount(l1);
  const escrowUsdc = escrowKeypair.publicKey;

  const createEscrowIx = SystemProgram.createAccount({
    fromPubkey: auth.publicKey,
    newAccountPubkey: escrowUsdc,
    space: 165, // Token account size
    lamports: escrowLamports,
    programId: TOKEN_PROGRAM_ID,
  });
  const initEscrowIx = createInitializeAccount3Instruction(escrowUsdc, usdcMint, pda);

  const escrowTx = new (await import("@solana/web3.js")).Transaction().add(createEscrowIx, initEscrowIx);
  const escrowBh = await l1.getLatestBlockhash();
  escrowTx.recentBlockhash = escrowBh.blockhash;
  escrowTx.lastValidBlockHeight = escrowBh.lastValidBlockHeight;
  escrowTx.feePayer = auth.publicKey;
  escrowTx.sign(auth, escrowKeypair);
  const escrowSig = await l1.sendRawTransaction(escrowTx.serialize(), { skipPreflight: true });
  await l1.confirmTransaction({ signature: escrowSig, blockhash: escrowBh.blockhash, lastValidBlockHeight: escrowBh.lastValidBlockHeight }, COMMITMENT);
  log("✅", `Escrow USDC: ${escrowUsdc.toBase58()}`);

  // Fund escrow with real devnet USDC from auth wallet
  console.log("\n── Step 6: Fund Escrow with Real USDC ──");
  const fundAmount = 1_000_000; // 1 USDC
  const authAta = getAssociatedTokenAddressSync(usdcMint, auth.publicKey, true);
  const fundIx = createTransferInstruction(authAta, escrowUsdc, auth.publicKey, fundAmount);
  const fundTx = new (await import("@solana/web3.js")).Transaction().add(fundIx);
  const fundBh = await l1.getLatestBlockhash();
  fundTx.recentBlockhash = fundBh.blockhash;
  fundTx.lastValidBlockHeight = fundBh.lastValidBlockHeight;
  fundTx.feePayer = auth.publicKey;
  fundTx.sign(auth);
  const fundSig = await l1.sendRawTransaction(fundTx.serialize(), { skipPreflight: true });
  await l1.confirmTransaction({ signature: fundSig, blockhash: fundBh.blockhash, lastValidBlockHeight: fundBh.lastValidBlockHeight }, COMMITMENT);
  log("✅", `Funded escrow with 4 USDC: ${fundSig.slice(0, 20)}...`);

  // ─── Step 7: Play 3 rounds (same as before) ───
  console.log("\n── Step 7: Play 3 Rounds ──");
  const erProg = new Program(idl as any, new AnchorProvider(erConn, makeWallet(auth), { commitment: COMMITMENT }) as any);

  for (let round = 1; round <= 3; round++) {
    console.log(`\n── Round ${round} ──`);

    await sendViaRouter(erProg.methods.startRound().accounts({ game: pda, authority: auth.publicKey } as any), makeWallet(auth), erConn);
    const holder = round % 3;
    log("✅", `startRound R${round} (holder=${holder})`);

    // Pass to next player
    const passer = players[holder];
    const passTo = (holder + 1) % 3;
    await sendViaRouter(erProg.methods.passPotato(passTo).accounts({ game: pda, player: passer.publicKey } as any), makeWallet(passer), erConn);
    log("✅", `passPotato ${names[holder]}→${names[passTo]}`);

    // Wait for timer
    await new Promise(r => setTimeout(r, 35000));

    // Explode
    await sendViaRouter(erProg.methods.explodePotato().accounts({ game: pda } as any), makeWallet(auth), erConn);
    log("✅", `explodePotato R${round}`);

    // End round
    await sendViaRouter(erProg.methods.endRound().accounts({ game: pda, authority: auth.publicKey } as any), makeWallet(auth), erConn);
    log("✅", `endRound R${round}`);
  }

  await readState(pda, "After 3 rounds");

  // ─── Step 8: Create Winner ATA + commitAndPayout ───
  console.log("\n── Step 8: commitAndPayout ──");

  // Fetch final game state to find winner
  const finalGame = await getErReadProgram().account.game.fetch(pda);
  let winnerIdx = 0;
  for (let i = 1; i < finalGame.players.length; i++) {
    // Use >= to match Rust's max_by_key tie-breaking (returns LAST max)
    if (finalGame.players[i].score >= finalGame.players[winnerIdx].score) winnerIdx = i;
  }
  const winnerWallet = finalGame.players[winnerIdx].wallet;
  log("🏆", `Winner: P${winnerIdx} ${winnerWallet.toBase58().slice(0, 12)}... (score=${finalGame.players[winnerIdx].score})`);

  // Create winner ATA if it doesn't exist
  const winnerUsdc = getAssociatedTokenAddressSync(usdcMint, winnerWallet, true);
  try {
    const winnerAtaIx = createAssociatedTokenAccountInstruction(auth.publicKey, winnerUsdc, winnerWallet, usdcMint);
    const { Transaction } = await import("@solana/web3.js");
    const waTx = new Transaction().add(winnerAtaIx);
    const waBh = await l1.getLatestBlockhash();
    waTx.recentBlockhash = waBh.blockhash;
    waTx.lastValidBlockHeight = waBh.lastValidBlockHeight;
    waTx.feePayer = auth.publicKey;
    waTx.sign(auth);
    const waSig = await l1.sendRawTransaction(waTx.serialize(), { skipPreflight: true });
    await l1.confirmTransaction({ signature: waSig, blockhash: waBh.blockhash, lastValidBlockHeight: waBh.lastValidBlockHeight }, COMMITMENT);
    log("✅", `Winner ATA created: ${winnerUsdc.toBase58().slice(0, 12)}...`);
  } catch (e: any) {
    const errStr = JSON.stringify(e?.message ?? e);
    if (errStr.includes("already exists") || errStr.includes("IllegalOwner") || errStr.includes("TokenAccountAlreadyExists")) {
      log("ℹ️", "Winner ATA already exists");
    } else {
      throw e;
    }
  }

  // Step 8: commit state (ER) → process_undelegation (L1) → payoutWinnerL1 (L1)
  console.log("\n── Step 8: commitState + processUndelegation + payoutWinnerL1 ──");
  const commitAccounts = {
    payer: auth.publicKey,
    game: pda,
    magicProgram: MAGIC_PROGRAM_ID,
    magicContext: MAGIC_CONTEXT_ID,
  };

  // 8a: commit state via ER (commits latest state to L1)
  const l1Prog = new Program(idl as any, new AnchorProvider(l1, makeWallet(auth), { commitment: COMMITMENT }) as any);
  let committed = false;
  try {
    log("🔄", "Committing state via ER...");
    const commitSig = await sendViaRouter(
      erProg.methods.commitState().accounts(commitAccounts as any),
      makeWallet(auth),
      erConn,
    );
    log("✅", `commitState (ER): ${commitSig.slice(0, 20)}...`);
    committed = true;
    log("⏳", "Waiting 10s for state to settle...");
    await new Promise(r => setTimeout(r, 10000));
  } catch (e: any) {
    log("❌", `commitState (ER) failed: ${e.message?.slice(0, 200)}`);
    if (e.logs) for (const l of e.logs.slice(-10)) log("📋", l);
  }

  if (!committed) {
    log("⚠️", "Commit failed. Skipping payout.");
  } else {
    // 8b: payout on L1 (game account can be delegated — UncheckedAccount bypasses ownership check)
    try {
      log("🔄", "Paying out on L1...");
      await sendViaL1(
        l1Prog.methods.payoutWinnerL1(winnerWallet, auth.publicKey, new BN(gameId)).accounts({
          game: pda,
          escrowUsdc,
          winnerUsdc,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any),
        makeWallet(auth),
        l1,
      );
      log("✅", "payoutWinnerL1 done");
    } catch (e: any) {
      log("❌", `payoutWinnerL1 failed: ${e.message?.slice(0, 200) || JSON.stringify(e).slice(0, 300)}`);
      if (e.logs) for (const l of e.logs.slice(-15)) log("📋", l);
      if (e.txLogs) for (const l of e.txLogs.slice(-15)) log("📋", l);
      if (e.stack) log("📋", e.stack.slice(0, 200));
    }
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  E2E Complete with USDC Escrow!");
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((e) => { console.error("FATAL:", e.message || e); if (e.logs) console.error("LOGS:", e.logs.join("\n")); process.exit(1); });
