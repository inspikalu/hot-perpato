/**
 * Devnet integration test for Hot Perp.
 * Full game flow on base layer (no ER delegation).
 *
 * Run:
 *   npx tsx tests/integration-test.ts
 *
 * The private key file is read from ~/Desktop/wallets/solana-wallets/HdPsZKwraou8oYnsSj1hyGRuW3zzEJnBQXkwVNChRkbD.json
 * or from the PRIVATE_KEY env var.
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

let _bs58: any;
async function getBs58() {
  if (!_bs58) {
    const paths = [
      "../app/node_modules/bs58",
      "../../app/node_modules/bs58",
      path.join(__dirname, "../app/node_modules/bs58"),
      path.join(process.cwd(), "app/node_modules/bs58"),
    ];
    for (const p of paths) {
      try { _bs58 = await import(p); break; } catch {}
    }
    if (!_bs58) {
      _bs58 = require("bs58");
    }
  }
  return _bs58;
}

const PROGRAM_ID = new PublicKey("9y5B6n8Lq8HipGsuwE7TrTW31y8T49xtFrZstYJeEV5w");
const GAME_SEED = Buffer.from("hot_perp_game");
const RPC = "https://api.devnet.solana.com";
const COMMITMENT = "confirmed";

function gamePda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([GAME_SEED, authority.toBuffer()], PROGRAM_ID);
}

function makeWallet(kp: Keypair) {
  return {
    publicKey: kp.publicKey,
    signTransaction: async (tx: any) => { tx.sign(kp); return tx; },
    signAllTransactions: async (txs: any[]) => { for (const tx of txs) tx.sign(kp); return txs; },
  } as any;
}

async function sendAndConfirm(program: Program<HotPerp>, method: any, signer: Keypair, label: string) {
  try {
    const tx = await method.transaction();
    const sig = await (program.provider as AnchorProvider).sendAndConfirm(tx, [signer]);
    console.log(`  ✅ ${label}: ${sig}`);
    return sig;
  } catch (err: any) {
    const logs = err.logs ? "\n    Logs: " + err.logs.slice(0, 8).join("\n    ") : "";
    console.log(`  ❌ ${label}: ${(err.message ?? String(err)).slice(0, 400)}${logs}`);
    throw err;
  }
}

async function fundIfNeeded(conn: Connection, kp: Keypair, funder: Keypair) {
  const bal = await conn.getBalance(kp.publicKey);
  if (bal < 0.01 * LAMPORTS_PER_SOL) {
    console.log(`  Funding ${kp.publicKey.toBase58().slice(0, 8)}... (balance: ${bal / LAMPORTS_PER_SOL} SOL)`);
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: kp.publicKey, lamports: 0.3 * LAMPORTS_PER_SOL })
    );
    const sig = await conn.sendTransaction(tx, [funder]);
    await conn.confirmTransaction(sig);
    console.log(`  Funded: ${sig}`);
  }
}

async function main() {
  console.log("\n═══ Hot Perp Devnet Integration Test ═══\n");

  // ── Load funded wallet ──
  let authority: Keypair;
  const envKey = process.env.PRIVATE_KEY;
  if (envKey) {
    const bs58 = await getBs58();
    authority = Keypair.fromSecretKey(bs58.decode(envKey));
  } else {
    const home = process.env.HOME || "/root";
    const keyPath = path.join(home, "Desktop/wallets/solana-wallets/HdPsZKwraou8oYnsSj1hyGRuW3zzEJnBQXkwVNChRkbD.json");
    const raw = fs.readFileSync(keyPath, "utf-8").trim();
    if (raw.startsWith("[")) {
      authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
    } else {
      const bs58 = await getBs58();
      authority = Keypair.fromSecretKey(bs58.decode(raw));
    }
  }
  console.log(`Authority: ${authority.publicKey.toBase58()}`);
  const conn = new Connection(RPC, COMMITMENT);
  const authBal = await conn.getBalance(authority.publicKey);
  console.log(`  Balance: ${authBal / LAMPORTS_PER_SOL} SOL`);

  // ── Generate & fund player keypairs ──
  const players = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
  console.log(`Players: ${players.map((p) => p.publicKey.toBase58().slice(0, 8)).join(", ")}`);
  for (const p of players) {
    await fundIfNeeded(conn, p, authority);
  }

  // ── Derive game PDA ──
  const [pda] = gamePda(authority.publicKey);
  console.log(`\nGame PDA: ${pda.toBase58()}`);

  // ── Create provider & program ──
  const provider = new AnchorProvider(conn, makeWallet(authority), { commitment: COMMITMENT });
  const program = new Program<HotPerp>(idl as HotPerp, provider as any);

  const config = { maxPlayers: 4, totalRounds: 3, stakeMode: { free: {} }, buyInAmount: new BN(0) };

  // ══════════════════════
  // 1. CREATE GAME
  // ══════════════════════
  console.log("\n── 1. Create Game ──");
  try {
    await sendAndConfirm(program,
      (program.methods as any).createGame(config).accounts({
        game: pda, user: authority.publicKey, systemProgram: SystemProgram.programId,
      }),
      authority, "createGame");
  } catch {
    const existing = await conn.getAccountInfo(pda);
    if (!existing) { console.log("  Game account missing — aborting."); process.exit(1); }
    console.log("  (game already exists)");
  }

  let game = await program.account.game.fetch(pda);
  console.log(`  State: ${JSON.stringify(game.state)}, Players: ${game.players.length}`);
  console.log(`  Owner: ${(await conn.getAccountInfo(pda))?.owner.toBase58()}`);

  // ══════════════════════
  // 2. JOIN GAME (base layer)
  // ══════════════════════
  console.log("\n── 2. Join Game ──");
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const pProvider = new AnchorProvider(conn, makeWallet(player), { commitment: COMMITMENT });
    const pProgram = new Program<HotPerp>(idl as HotPerp, pProvider as any);
    try {
      await sendAndConfirm(pProgram,
        (pProgram.methods as any).joinGame().accounts({ game: pda, player: player.publicKey }),
        player, `joinGame (player ${i})`);
    } catch (err: any) {
      if (err.message?.includes("AlreadyJoined")) {
        console.log(`  Player ${i} already joined`);
      }
    }
  }

  game = await program.account.game.fetch(pda);
  console.log(`  Players in game: ${game.players.length}`);

  // ══════════════════════
  // 3. START ROUND
  // ══════════════════════
  if (game.players.length >= 2) {
    console.log("\n── 3. Start Round ──");
    try {
      await sendAndConfirm(program,
        (program.methods as any).startRound().accounts({ game: pda, authority: authority.publicKey }),
        authority, "startRound");
    } catch (err: any) {
      console.log("  startRound failed (may need specific game state):", (err.message ?? "").slice(0, 200));
    }
    game = await program.account.game.fetch(pda);
    console.log(`  State: ${JSON.stringify(game.state)}, Round: ${game.round}, Holder: ${game.currentHolder}`);

    // ══════════════════════
    // 4. PASS POTATO
    // ══════════════════════
    if (game.state.active !== undefined) {
      console.log("\n── 4. Pass Potato ──");
      const holderIdx = game.currentHolder as number;
      const holder = players[holderIdx];
      if (holder) {
        const target = holderIdx === 0 ? 1 : 0;
        const hProvider = new AnchorProvider(conn, makeWallet(holder), { commitment: COMMITMENT });
        const hProgram = new Program<HotPerp>(idl as HotPerp, hProvider as any);
        try {
          await sendAndConfirm(hProgram,
            (hProgram.methods as any).passPotato(target).accounts({ game: pda, player: holder.publicKey }),
            holder, `passPotato ${holderIdx}→${target}`);
        } catch (err: any) {
          console.log("  passPotato failed:", (err.message ?? "").slice(0, 200));
        }
        game = await program.account.game.fetch(pda);
        console.log(`  New holder: ${game.currentHolder}`);
      }
    }

    // ══════════════════════
    // 5. EXPLODE (wait for timer)
    // ══════════════════════
    if (game.state.active !== undefined) {
      console.log("\n── 5. Explode Potato ──");
      const deadline = game.timerDeadline.toNumber();
      const wait = Math.max(0, deadline - Math.floor(Date.now() / 1000) + 5);
      if (wait > 0) {
        console.log(`  Waiting ${wait}s for timer...`);
        await new Promise((r) => setTimeout(r, wait * 1000));
      }
      try {
        await sendAndConfirm(program,
          (program.methods as any).explodePotato().accounts({ game: pda }),
          authority, "explodePotato");
      } catch (err: any) {
        console.log("  explodePotato failed:", (err.message ?? "").slice(0, 200));
      }
      game = await program.account.game.fetch(pda);
      console.log(`  State: ${JSON.stringify(game.state)}`);
    }

    // ══════════════════════
    // 6. END ROUND
    // ══════════════════════
    if (game.state.exploded !== undefined) {
      console.log("\n── 6. End Round ──");
      try {
        await sendAndConfirm(program,
          (program.methods as any).endRound().accounts({ game: pda, authority: authority.publicKey }),
          authority, "endRound");
      } catch (err: any) {
        console.log("  endRound failed:", (err.message ?? "").slice(0, 200));
      }
      game = await program.account.game.fetch(pda);
      console.log(`  State: ${JSON.stringify(game.state)}`);
    }
  }

  console.log("\n═══ Test Complete ═══");
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
