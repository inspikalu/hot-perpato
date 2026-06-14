/**
 * Two-account integration test for Hot Perpato.
 * Tests: host creates game → player signs + joins → play full round.
 *
 * Run:
 *   npx tsx tests/two-accounts-test.ts
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@anchor-lang/core";
import * as fs from "fs";
import * as path from "path";
import idl from "../target/idl/hot_perp.json";
import type { HotPerp } from "../target/types/hot_perp";

const PROGRAM_ID = new PublicKey("9y5B6n8Lq8HipGsuwE7TrTW31y8T49xtFrZstYJeEV5w");
const GAME_SEED = Buffer.from("hot_perp_game");
const RPC = "https://api.devnet.solana.com";
const COMMITMENT = "confirmed";

function loadKeypair(relativePath: string): Keypair {
  const p = relativePath.replace(/^~/, process.env.HOME || "/root");
  const raw = fs.readFileSync(p, "utf-8").trim();
  if (raw.startsWith("[")) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  }
  // base58
  const bs58 = require("bs58");
  return Keypair.fromSecretKey(bs58.decode(raw));
}

function gamePda(authority: PublicKey, gameId: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(gameId));
  return PublicKey.findProgramAddressSync(
    [GAME_SEED, authority.toBuffer(), buf],
    PROGRAM_ID,
  );
}

async function sendTx(conn: Connection, tx: Transaction, signers: Keypair[], label: string) {
  try {
    const sig = await conn.sendTransaction(tx, signers, { skipPreflight: true, preflightCommitment: COMMITMENT });
    const result = await conn.confirmTransaction(sig, COMMITMENT);
    if (result.value.err) {
      console.log(`  ❌ ${label}: ${JSON.stringify(result.value.err)}`);
    } else {
      console.log(`  ✅ ${label}: ${sig}`);
    }
    return sig;
  } catch (err: any) {
    console.log(`  ❌ ${label}: ${err.message ?? err.logs ?? "unknown"}`);
    throw err;
  }
}

async function main() {
  console.log("\n═══ Hot Perpato Two-Account Test ═══\n");

  // ── Load wallets ──
  const host = loadKeypair("~/Desktop/wallets/solana-wallets/HdPsZKwraou8oYnsSj1hyGRuW3zzEJnBQXkwVNChRkbD.json");
  const player = loadKeypair("~/Desktop/wallets/solana-wallets/AVq5Q7CeALotLmJ1frLPppxbXB5QvgNk8y9Uk6H3tRMY.json");

  console.log(`Host:   ${host.publicKey.toBase58()}`);
  console.log(`Player: ${player.publicKey.toBase58()}`);

  const conn = new Connection(RPC, COMMITMENT);

  // Check balances
  const hostBal = await conn.getBalance(host.publicKey);
  const playerBal = await conn.getBalance(player.publicKey);
  console.log(`  Host balance: ${hostBal / LAMPORTS_PER_SOL} SOL`);
  console.log(`  Player balance: ${playerBal / LAMPORTS_PER_SOL} SOL`);

  if (playerBal < 0.01 * LAMPORTS_PER_SOL) {
    console.log(`  Funding player from host...`);
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: host.publicKey, toPubkey: player.publicKey, lamports: 0.5 * LAMPORTS_PER_SOL })
    );
    const sig = await conn.sendTransaction(tx, [host], { skipPreflight: true });
    await conn.confirmTransaction(sig, COMMITMENT);
    console.log(`  Funded: ${sig}`);
  }

  // ── Game config (unique gameId per run to avoid conflicts) ──
  const gameId = Math.floor(Date.now() % 100000);
  const [pda] = gamePda(host.publicKey, gameId);
  console.log(`\nGame PDA: ${pda.toBase58()} (game #${gameId})`);

  // ── Program setup ──
  const provider = new AnchorProvider(
    conn,
    {
      publicKey: host.publicKey,
      signTransaction: async (tx: any) => { tx.sign(host); return tx; },
      signAllTransactions: async (txs: any[]) => { for (const tx of txs) tx.sign(host); return txs; },
    } as any,
    { commitment: COMMITMENT, skipPreflight: true },
  );
  const program = new Program<HotPerp>(idl as HotPerp, provider as any);

  // ════════════════════════════
  // 1. HOST CREATES GAME
  // ════════════════════════════
  console.log("\n── 1. Host creates game ──");
  const config = { gameId: new BN(gameId), maxPlayers: 2, totalRounds: 2, stakeMode: { free: {} }, buyInAmount: new BN(0) };
  try {
    const tx1 = await (program.methods as any).createGame(config).accounts({
      game: pda, user: host.publicKey, systemProgram: SystemProgram.programId,
    }).transaction();
    await sendTx(conn, tx1, [host], "createGame");
  } catch (err: any) {
    const info = await conn.getAccountInfo(pda);
    if (!info) { console.log("  Game not created — aborting"); process.exit(1); }
    console.log("  (game already exists)");
  }

  let game = await (program as any).account.game.fetch(pda).catch(() => null);
  if (!game) { console.log("  Failed to fetch game — aborting"); process.exit(1); }
  console.log(`  State: ${JSON.stringify(game.state)}, Owner: ${(await conn.getAccountInfo(pda))?.owner.toBase58().slice(0, 8)}...`);

  // ════════════════════════════
  // 2. PLAYER JOINS GAME
  // ════════════════════════════
  console.log("\n── 2. Player joins game ──");
  const pProvider = new AnchorProvider(
    conn,
    {
      publicKey: player.publicKey,
      signTransaction: async (tx: any) => { tx.sign(player); return tx; },
      signAllTransactions: async (txs: any[]) => { for (const tx of txs) tx.sign(player); return txs; },
    } as any,
    { commitment: COMMITMENT, skipPreflight: true },
  );
  const pProgram = new Program<HotPerp>(idl as HotPerp, pProvider as any);

  try {
    const tx2 = await (pProgram.methods as any).joinGame().accounts({
      game: pda, player: player.publicKey,
    }).transaction();
    await sendTx(conn, tx2, [player], "joinGame");
  } catch (err: any) {
    if (err.message?.includes("AlreadyJoined")) {
      console.log("  (already joined)");
    } else { throw err; }
  }

  // ════════════════════════════
  // 3. HOST JOINS GAME
  // ════════════════════════════
  console.log("\n── 3. Host joins game ──");
  try {
    const tx3 = await (program.methods as any).joinGame().accounts({
      game: pda, player: host.publicKey,
    }).transaction();
    await sendTx(conn, tx3, [host], "joinGame (host)");
  } catch (err: any) {
    if (err.message?.includes("AlreadyJoined")) {
      console.log("  (already joined)");
    } else { throw err; }
  }

  game = await (program as any).account.game.fetch(pda);
  console.log(`  Players: ${game.players.length}/2`);

  // ════════════════════════════
  // 4. HOST STARTS ROUND
  // ════════════════════════════
  console.log("\n── 4. Host starts round ──");
  const tx4 = await (program.methods as any).startRound().accounts({
    game: pda, authority: host.publicKey,
  }).transaction();
  await sendTx(conn, tx4, [host], "startRound");

  game = await (program as any).account.game.fetch(pda);
  console.log(`  State: ${JSON.stringify(game.state)}, Round: ${game.round}, Holder: ${game.currentHolder}`);

  // ════════════════════════════
  // 5. HOLDER PASSES POTATO
  // ════════════════════════════
  console.log("\n── 5. Pass potato ──");
  const holderIdx = game.currentHolder as number;
  const wallets = [player, host]; // match player order: player joined first (idx0), host second (idx1)
  const holder = wallets[holderIdx];
  const holderProgram = holderIdx === 0 ? pProgram : program;
  const target = holderIdx === 0 ? 1 : 0;

  const tx5 = await (holderProgram.methods as any).passPotato(target).accounts({
    game: pda, player: holder.publicKey,
  }).transaction();
  await sendTx(conn, tx5, [holder], `passPotato ${holderIdx}→${target}`);

  game = await (program as any).account.game.fetch(pda);
  console.log(`  New holder: ${game.currentHolder}`);

  // ════════════════════════════
  // 6. EXPLODE (wait for timer)
  // ════════════════════════════
  console.log("\n── 6. Explode potato ──");
  const deadline = game.timerDeadline.toNumber();
  const wait = Math.max(0, deadline - Math.floor(Date.now() / 1000) + 3);
  if (wait > 0) {
    console.log(`  Waiting ${wait}s for timer...`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  const tx6 = await (program.methods as any).explodePotato().accounts({
    game: pda,
  }).transaction();
  await sendTx(conn, tx6, [host], "explodePotato");

  game = await (program as any).account.game.fetch(pda);
  console.log(`  State: ${JSON.stringify(game.state)}`);

  // ════════════════════════════
  // 7. END ROUND
  // ════════════════════════════
  console.log("\n── 7. End round ──");
  const tx7 = await (program.methods as any).endRound().accounts({
    game: pda, authority: host.publicKey,
  }).transaction();
  await sendTx(conn, tx7, [host], "endRound");

  game = await (program as any).account.game.fetch(pda);
  console.log(`  State: ${JSON.stringify(game.state)}`);

  // ════════════════════════════
  // SUMMARY
  // ════════════════════════════
  console.log("\n═══ Two-Account Test Complete ═══");
  console.log(`Game PDA: ${pda.toBase58()}`);
  console.log(`Final state: ${JSON.stringify(game.state)}`);
  console.log(`Round: ${game.round}/${game.config.totalRounds}`);
  console.log(`Players: ${game.players.length}`);
  for (let i = 0; i < game.players.length; i++) {
    const p = game.players[i];
    console.log(`  ${i}: ${p.wallet.toBase58().slice(0, 8)}... score=${p.score} passes=${p.passesMade}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
