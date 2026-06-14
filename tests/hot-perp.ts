import * as anchor from "@anchor-lang/core";
import { Program, BN } from "@anchor-lang/core";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { HotPerp } from "../target/types/hot_perp";
import { expect } from "chai";

const GAME_SEED = Buffer.from("hot_perp_game");

function gamePda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [GAME_SEED, authority.toBuffer()],
    new PublicKey("9y5B6n8Lq8HipGsuwE7TrTW31y8T49xtFrZstYJeEV5w")
  );
}

function stakeModeFree() {
  return { free: {} };
}

async function fundAccounts(
  provider: anchor.AnchorProvider,
  kps: Keypair[]
): Promise<void> {
  for (const kp of kps) {
    const sig = await provider.connection.requestAirdrop(
      kp.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig, "confirmed");
  }
}

async function warpClock(
  provider: anchor.AnchorProvider,
  seconds: number
): Promise<void> {
  const conn = provider.connection as any;
  const slot = await conn.getSlot();
  const targetSlot = slot + Math.max(seconds * 4, 120);

  // Try warp_to_slot cheatcode
  try {
    await conn._rpcRequest("warp_to_slot", [targetSlot]);
  } catch {}

  // Always send airdrops as backup to ensure time advances
  const dummy = Keypair.generate();
  const count = Math.max(200, targetSlot - slot);
  for (let i = 0; i < count; i++) {
    const sig = await conn.requestAirdrop(dummy.publicKey, LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
  }
}

describe("hot_perp", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.HotPerp as Program<HotPerp>;

  const authority = Keypair.generate();
  const player1 = Keypair.generate();
  const player2 = Keypair.generate();
  const player3 = Keypair.generate();

  const config = {
    maxPlayers: 4,
    totalRounds: 3,
    stakeMode: stakeModeFree(),
    buyInAmount: new BN(0),
  };

  // Players in game order (as they'll appear in the players vec)
  const allPlayers = [player1, player2, player3];

  before(async () => {
    await fundAccounts(provider, [authority, player1, player2, player3]);
  });

  it("creates a game", async () => {
    const [pda] = gamePda(authority.publicKey);
    await program.methods
      .createGame(config)
      .accounts({
        game: pda,
        user: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const game = await program.account.game.fetch(pda);
    expect(game.authority.equals(authority.publicKey)).to.be.true;
    expect(game.state).to.deep.equal({ waiting: {} });
    expect(game.players).to.have.length(0);
  });

  it("allows players to join", async () => {
    const [pda] = gamePda(authority.publicKey);

    for (const player of allPlayers) {
      await program.methods
        .joinGame()
        .accounts({ game: pda, player: player.publicKey })
        .signers([player])
        .rpc();
    }

    const game = await program.account.game.fetch(pda);
    expect(game.players).to.have.length(3);
    // Verify player order
    game.players.forEach((p: any, i: number) => {
      expect(p.wallet.equals(allPlayers[i].publicKey)).to.be.true;
    });
  });

  it("rejects duplicate join", async () => {
    const [pda] = gamePda(authority.publicKey);
    try {
      await program.methods
        .joinGame()
        .accounts({ game: pda, player: player1.publicKey })
        .signers([player1])
        .rpc();
      expect.fail("should have thrown");
    } catch (e: any) {
      expect(e.error.errorCode.code).to.equal("AlreadyJoined");
    }
  });

  it("rejects join when lobby is full", async () => {
    const freshAuth = Keypair.generate();
    await fundAccounts(provider, [freshAuth]);

    const [pda] = gamePda(freshAuth.publicKey);
    await program.methods
      .createGame({
        maxPlayers: 2,
        totalRounds: 3,
        stakeMode: stakeModeFree(),
        buyInAmount: new BN(0),
      })
      .accounts({
        game: pda,
        user: freshAuth.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([freshAuth])
      .rpc();

    const fp1 = Keypair.generate();
    const fp2 = Keypair.generate();
    await fundAccounts(provider, [fp1, fp2]);

    for (const p of [fp1, fp2]) {
      await program.methods
        .joinGame()
        .accounts({ game: pda, player: p.publicKey })
        .signers([p])
        .rpc();
    }

    const fp3 = Keypair.generate();
    await fundAccounts(provider, [fp3]);
    try {
      await program.methods
        .joinGame()
        .accounts({ game: pda, player: fp3.publicKey })
        .signers([fp3])
        .rpc();
      expect.fail("should have thrown");
    } catch (e: any) {
      expect(e.error.errorCode.code).to.equal("LobbyFull");
    }
  });

  it("starts a round", async () => {
    const [pda] = gamePda(authority.publicKey);

    await program.methods
      .startRound()
      .accounts({ game: pda, authority: authority.publicKey })
      .signers([authority])
      .rpc();

    const game = await program.account.game.fetch(pda);
    expect(game.state).to.deep.equal({ active: {} });
    expect(game.round).to.equal(1);
    // Holder = round(1) % players(3) = index 1
    expect(game.currentHolder).to.equal(1);
  });

  it("rejects start with < 2 players", async () => {
    const freshAuth = Keypair.generate();
    await fundAccounts(provider, [freshAuth]);
    const [pda] = gamePda(freshAuth.publicKey);

    await program.methods
      .createGame(config)
      .accounts({
        game: pda,
        user: freshAuth.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([freshAuth])
      .rpc();

    try {
      await program.methods
        .startRound()
        .accounts({ game: pda, authority: freshAuth.publicKey })
        .signers([freshAuth])
        .rpc();
      expect.fail("should have thrown");
    } catch (e: any) {
      expect(e.error.errorCode.code).to.equal("NotEnoughPlayers");
    }
  });

  it("allows passing the potato", async () => {
    const [pda] = gamePda(authority.publicKey);
    const game = await program.account.game.fetch(pda);
    const holderIdx = game.currentHolder as number;
    // holderIdx maps to allPlayers (player2 at index 1)
    const holder = allPlayers[holderIdx];

    const toIdx = 0; // pass to player1 at index 0

    await program.methods
      .passPotato(toIdx)
      .accounts({ game: pda, player: holder.publicKey })
      .signers([holder])
      .rpc();

    const updated = await program.account.game.fetch(pda);
    expect(updated.currentHolder).to.equal(toIdx);
  });

  it("rejects pass from non-holder", async () => {
    const [pda] = gamePda(authority.publicKey);
    const game = await program.account.game.fetch(pda);
    const holderIdx = game.currentHolder as number;
    const nonHolder = allPlayers.find((_, i) => i !== holderIdx)!;

    try {
      await program.methods
        .passPotato(holderIdx === 0 ? 1 : 0)
        .accounts({ game: pda, player: nonHolder.publicKey })
        .signers([nonHolder])
        .rpc();
      expect.fail("should have thrown");
    } catch (e: any) {
      expect(e.error.errorCode.code).to.equal("NotHolder");
    }
  });

  it("rejects pass to self", async () => {
    const [pda] = gamePda(authority.publicKey);
    const game = await program.account.game.fetch(pda);
    const holderIdx = game.currentHolder as number;
    const holder = allPlayers[holderIdx];

    try {
      await program.methods
        .passPotato(holderIdx)
        .accounts({ game: pda, player: holder.publicKey })
        .signers([holder])
        .rpc();
      expect.fail("should have thrown");
    } catch (e: any) {
      expect(e.error.errorCode.code).to.equal("InvalidPlayerIndex");
    }
  });

  it("rejects explode when timer not expired", async () => {
    const [pda] = gamePda(authority.publicKey);
    const game = await program.account.game.fetch(pda);
    expect(game.state).to.deep.equal({ active: {} });

    try {
      await program.methods
        .explodePotato()
        .accounts({ game: pda })
        .rpc();
      expect.fail("should have thrown");
    } catch (e: any) {
      expect(e.error.errorCode.code).to.equal("TimerNotExpired");
    }
  });

  it("explodes and scores correctly", async () => {
    const [pda] = gamePda(authority.publicKey);

    // Advance clock past 30s deadline
    await warpClock(provider, 35);

    const before = await program.account.game.fetch(pda);
    const holderIdx = before.currentHolder as number;
    const beforeScores = before.players.map((p: any) => p.score);

    await program.methods
      .explodePotato()
      .accounts({ game: pda })
      .rpc();

    const after = await program.account.game.fetch(pda);
    expect(after.state).to.deep.equal({ exploded: {} });

    for (let i = 0; i < after.players.length; i++) {
      if (i === holderIdx) {
        expect(after.players[i].score).to.equal(beforeScores[i] - 1);
      } else {
        expect(after.players[i].score).to.equal(beforeScores[i] + 1);
      }
    }
  });

  it("ends round and transitions to waiting", async () => {
    const [pda] = gamePda(authority.publicKey);

    await program.methods
      .endRound()
      .accounts({ game: pda, authority: authority.publicKey })
      .signers([authority])
      .rpc();

    const game = await program.account.game.fetch(pda);
    expect(game.state).to.deep.equal({ waiting: {} });
  });

  it("plays a complete 3-round game", async () => {
    const freshAuth = Keypair.generate();
    const freshPlayers = [
      Keypair.generate(),
      Keypair.generate(),
      Keypair.generate(),
    ];
    await fundAccounts(provider, [freshAuth, ...freshPlayers]);

    const [pda] = gamePda(freshAuth.publicKey);

    await program.methods
      .createGame(config)
      .accounts({
        game: pda,
        user: freshAuth.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([freshAuth])
      .rpc();

    for (const p of freshPlayers) {
      await program.methods
        .joinGame()
        .accounts({ game: pda, player: p.publicKey })
        .signers([p])
        .rpc();
    }

    for (let r = 1; r <= 3; r++) {
      await program.methods
        .startRound()
        .accounts({ game: pda, authority: freshAuth.publicKey })
        .signers([freshAuth])
        .rpc();

      let game = await program.account.game.fetch(pda);
      expect(game.state).to.deep.equal({ active: {} });
      expect(game.round).to.equal(r);

      // Advance clock past 30s deadline
      await warpClock(provider, 35);

      await program.methods
        .explodePotato()
        .accounts({ game: pda })
        .rpc();

      game = await program.account.game.fetch(pda);
      expect(game.state).to.deep.equal({ exploded: {} });

      await program.methods
        .endRound()
        .accounts({ game: pda, authority: freshAuth.publicKey })
        .signers([freshAuth])
        .rpc();
    }

    const final = await program.account.game.fetch(pda);
    expect(final.state).to.deep.equal({ finished: {} });
  });
});
