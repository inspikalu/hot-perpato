import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, VersionedTransaction, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@anchor-lang/core";
import { ConnectionMagicRouter } from "@magicblock-labs/ephemeral-rollups-sdk";
import * as fs from "fs";
import idl from "../target/idl/hot_perp.json";
import type { HotPerp } from "../target/types/hot_perp";

const PROGRAM_ID = new PublicKey("9y5B6n8Lq8HipGsuwE7TrTW31y8T49xtFrZstYJeEV5w");
const DELEGATION_PROGRAM_ID = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const GAME_SEED = Buffer.from("hot_perp_game");
const DEVNET_RPC = "https://api.devnet.solana.com";
const MAGIC_ROUTER_RPC = "https://devnet-router.magicblock.app";
const COMMITMENT = "confirmed";

const TAG = {
  BUFFER: Buffer.from("buffer"),
  DELEGATION_RECORD: Buffer.from("delegation"),
  DELEGATION_METADATA: Buffer.from("delegation-metadata"),
};

function gamePda(authority: PublicKey, gameId: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(gameId));
  return PublicKey.findProgramAddressSync([GAME_SEED, authority.toBuffer(), buf], PROGRAM_ID);
}

function makeWallet(kp: Keypair) {
  return {
    publicKey: kp.publicKey,
    signTransaction: async (tx: any) => { tx.sign(kp); return tx; },
    signAllTransactions: async (txs: any[]) => { for (const tx of txs) tx.sign(kp); return txs; },
  } as any;
}

async function main() {
  console.log("\n═══ Hot Perp E2E Test (Devnet) ═══\n");

  const deployKpRaw = JSON.parse(fs.readFileSync(process.env.HOME + "/.config/solana/id.json", "utf-8"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(deployKpRaw));
  console.log(`Authority: ${authority.publicKey.toBase58()}`);

  const conn = new Connection(DEVNET_RPC, COMMITMENT);
  const bal = await conn.getBalance(authority.publicKey);
  console.log(`  Balance: ${bal / LAMPORTS_PER_SOL} SOL`);

  const gameId = Math.floor(Date.now() % 100000);
  const [pda] = gamePda(authority.publicKey, gameId);
  console.log(`Game #${gameId} PDA: ${pda.toBase58()}`);

  // Derive delegation PDAs
  const [bufferGame] = PublicKey.findProgramAddressSync([TAG.BUFFER, pda.toBuffer()], PROGRAM_ID);
  const [delegationRecordGame] = PublicKey.findProgramAddressSync(
    [TAG.DELEGATION_RECORD, pda.toBuffer()], DELEGATION_PROGRAM_ID,
  );
  const [delegationMetadataGame] = PublicKey.findProgramAddressSync(
    [TAG.DELEGATION_METADATA, pda.toBuffer()], DELEGATION_PROGRAM_ID,
  );

  const provider = new AnchorProvider(new Connection(DEVNET_RPC, COMMITMENT), makeWallet(authority), {
    commitment: COMMITMENT, skipPreflight: true,
  });
  const program = new Program<HotPerp>(idl as HotPerp, provider as any);

  // 1. CREATE GAME
  console.log("\n── 1. Create Game ──");
  const config = { gameId: new BN(gameId), maxPlayers: 4, totalRounds: 3, stakeMode: { free: {} }, buyInAmount: new BN(0) };
  const tx1 = await (program.methods as any).createGame(config).accounts({
    game: pda, user: authority.publicKey, systemProgram: SystemProgram.programId,
  }).transaction();
  const sig1 = await conn.sendTransaction(tx1, [authority], { skipPreflight: true, preflightCommitment: COMMITMENT });
  await conn.confirmTransaction(sig1, COMMITMENT);
  console.log(`  ✅ createGame: ${sig1}`);

  let game = await (program as any).account.game.fetch(pda);
  console.log(`  State: ${JSON.stringify(game.state)}, Players: ${game.players.length}`);

  // 2. JOIN GAME (before delegation - game is still on L1)
  console.log("\n── 2. Join Game (on L1, before delegation) ──");
  
  // Join authority
  const txJoinAuth = await (program.methods as any).joinGame().accounts({
    game: pda,
    player: authority.publicKey,
  }).transaction();
  const sigJoinAuth = await conn.sendTransaction(txJoinAuth, [authority], { skipPreflight: true, preflightCommitment: COMMITMENT });
  await conn.confirmTransaction(sigJoinAuth, COMMITMENT);
  console.log(`  ✅ joinGame (authority): ${sigJoinAuth}`);

  // Try to add a second player
  try {
    const player1 = Keypair.generate();
    const sigAirdrop = await conn.requestAirdrop(player1.publicKey, 0.1 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sigAirdrop, COMMITMENT);
    
    const txJoin = await (program.methods as any).joinGame().accounts({
      game: pda,
      player: player1.publicKey,
    }).transaction();
    const sigJoin = await conn.sendTransaction(txJoin, [player1], { skipPreflight: true, preflightCommitment: COMMITMENT });
    await conn.confirmTransaction(sigJoin, COMMITMENT);
    console.log(`  ✅ joinGame (player1): ${sigJoin}`);
  } catch (e: any) {
    console.log(`  ⚠️  Could not add second player (airdrop failed): ${e.message?.slice(0, 100)}`);
  }

  game = await (program as any).account.game.fetch(pda);
  console.log(`  Players: ${game.players.length}`);

  // 3. DELEGATE GAME (after joins)
  console.log("\n── 3. Delegate Game ──");
  try {
    const tx2 = await (program.methods as any).delegateGame().accounts({
      payer: authority.publicKey,
      game: pda,
      bufferGame,
      delegationRecordGame,
      delegationMetadataGame,
      ownerProgram: PROGRAM_ID,
      delegationProgram: DELEGATION_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).transaction();
    const sig2 = await conn.sendTransaction(tx2, [authority], { skipPreflight: true, preflightCommitment: COMMITMENT });
    await conn.confirmTransaction(sig2, COMMITMENT);
    console.log(`  ✅ delegateGame: ${sig2}`);
  } catch (err: any) {
    const logs = err.logs?.slice(0, 20).join("\n    ") ?? "";
    console.log(`  ❌ delegateGame: ${err.message?.slice(0, 300)}`);
    if (logs) console.log(`    Logs:\n    ${logs}`);
  }

  // 4. Check delegation
  const info = await conn.getAccountInfo(pda);
  console.log(`\n── 4. Post-Delegation ──`);
  console.log(`  Owner: ${info?.owner?.toBase58() ?? "NONE"}`);
  if (info?.owner?.equals(DELEGATION_PROGRAM_ID)) {
    console.log(`  ✅ Game account delegated to ER!`);
  } else if (info?.owner?.equals(PROGRAM_ID)) {
    console.log(`  ℹ️  Still owned by our program`);
  }

  // 5. START ROUND (on ER via Magic Router)
  console.log("\n── 5. Start Round (ER via Magic Router) ──");
  try {
    const magicRouter = new ConnectionMagicRouter(MAGIC_ROUTER_RPC);
    
    // Build the transaction with ER program using L1 connection for blockhash
    const erConnForBuild = new Connection(DEVNET_RPC, COMMITMENT);
    const erProvider = new AnchorProvider(erConnForBuild, makeWallet(authority), {
      commitment: COMMITMENT, skipPreflight: true,
    });
    const erProgram = new Program<HotPerp>(idl as HotPerp, erProvider as any);
    
    const tx = await (erProgram.methods as any).startRound().accounts({
      game: pda,
      authority: authority.publicKey,
    }).transaction();
    
    // Get blockhash from L1
    const bh = await erConnForBuild.getLatestBlockhash();
    tx.feePayer = authority.publicKey;
    tx.recentBlockhash = bh.blockhash;
    tx.lastValidBlockHeight = bh.lastValidBlockHeight;
    
    // Sign with keypair (partialSign)
    tx.partialSign(authority);
    
    // Send via Magic Router
    const sig = await magicRouter.sendRawTransaction(tx.serialize());
    await magicRouter.confirmTransaction({
      signature: sig,
      blockhash: bh.blockhash,
      lastValidBlockHeight: bh.lastValidBlockHeight,
    }, COMMITMENT);
    console.log(`  ✅ startRound (ER): ${sig}`);
  } catch (err: any) {
    console.log(`  ❌ startRound (ER): ${err.message?.slice(0, 300)}`);
    if (err.logs) console.log(`    Logs:\n${err.logs.slice(0, 10).join("\n    ")}`);
    // Fallback: try via L1 (won't persist for delegated account, but tests the instruction)
    try {
      const txStart = await (program.methods as any).startRound().accounts({
        game: pda,
        authority: authority.publicKey,
      }).transaction();
      const sigStart = await conn.sendTransaction(txStart, [authority], { skipPreflight: true, preflightCommitment: COMMITMENT });
      await conn.confirmTransaction(sigStart, COMMITMENT);
      console.log(`  ⚠️  startRound (L1 fallback - won't persist for delegated): ${sigStart}`);
    } catch (err2: any) {
      console.log(`  ❌ startRound (L1): ${err2.message?.slice(0, 300)}`);
    }
  }

  // 6. CHECK GAME STATE
  console.log("\n── 6. Game State ──");
  game = await (program as any).account.game.fetch(pda);
  console.log(`  State: ${JSON.stringify(game.state)}`);
  console.log(`  Round: ${game.round}`);
  console.log(`  Current Holder: ${game.currentHolder}`);
  console.log(`  Timer Deadline: ${game.timerDeadline?.toNumber()}`);

  console.log("\n═══ E2E Test Complete ═══\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
