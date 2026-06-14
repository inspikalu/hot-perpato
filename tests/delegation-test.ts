import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@anchor-lang/core";
import * as fs from "fs";
import idl from "../target/idl/hot_perp.json";
import type { HotPerp } from "../target/types/hot_perp";

const PROGRAM_ID = new PublicKey("9y5B6n8Lq8HipGsuwE7TrTW31y8T49xtFrZstYJeEV5w");
const DELEGATION_PROGRAM_ID = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const GAME_SEED = Buffer.from("hot_perp_game");
const DEVNET_RPC = "https://api.devnet.solana.com";
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
  console.log("\n═══ Hot Perp Delegation Test (Devnet) ═══\n");

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

  // 2. DELEGATE GAME
  console.log("\n── 2. Delegate Game ──");
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

  // 3. Check delegation
  const info = await conn.getAccountInfo(pda);
  console.log(`\n── 3. Post-Delegation ──`);
  console.log(`  Owner: ${info?.owner?.toBase58() ?? "NONE"}`);
  console.log(`  Delegation Prog: ${DELEGATION_PROGRAM_ID.toBase58()}`);
  if (info?.owner?.equals(DELEGATION_PROGRAM_ID)) {
    console.log(`  ✅ Game account delegated to ER!`);
  } else if (info?.owner?.equals(PROGRAM_ID)) {
    console.log(`  ℹ️  Still owned by our program`);
  }

  console.log("\n═══ Test Complete ═══\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
