import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { assert } from "chai";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";

const EVENT_SEED = Buffer.from("event");
const VAULT_STATE_SEED = Buffer.from("vault-state");
const VAULT_TREASURY_SEED = Buffer.from("vault-treasury");
const PASS_SEED = Buffer.from("event-pass");
const LOYALTY_MINT_SEED = Buffer.from("loyalty-mint");
const ADAPTER_RESERVE_SEED = Buffer.from("adapter-reserve");

const expectAnchorError = (err: unknown, code: string) => {
  let anchorErr: anchor.AnchorError | null = null;
  try {
    anchorErr = anchor.AnchorError.parse(err);
  } catch (parseErr) {
    if (parseErr) {
      // ignore parse failure, fallback below
    }
  }
  if (!anchorErr && err instanceof anchor.AnchorError) {
    anchorErr = err;
  }
  if (anchorErr) {
    assert.equal(anchorErr.error.errorCode.code, code);
    return;
  }
  const possible = err as { error?: { errorCode?: { code?: string } } };
  if (possible?.error?.errorCode?.code === code) {
    return;
  }
  assert.fail(`Expected AnchorError with code ${code}, received ${JSON.stringify(err)}`);
};

describe("eventflux anchor program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.anchorProject as anchor.Program;
  const vaultStub = anchor.workspace.vaultStub as anchor.Program;

  const randomEventId = () => new BN(Date.now() + Math.floor(Math.random() * 1_000));
  const organizer = provider.wallet as anchor.Wallet;

  const findEventPdas = (organizerPubkey: PublicKey, eventId: BN) => {
    const idBuffer = eventId.toArrayLike(Buffer, "le", 8);
    const [eventPda] = PublicKey.findProgramAddressSync(
      [EVENT_SEED, organizerPubkey.toBuffer(), idBuffer],
      program.programId
    );
    const [vaultStatePda] = PublicKey.findProgramAddressSync(
      [VAULT_STATE_SEED, eventPda.toBuffer()],
      program.programId
    );
    const [vaultTreasuryPda] = PublicKey.findProgramAddressSync(
      [VAULT_TREASURY_SEED, eventPda.toBuffer()],
      program.programId
    );

    return { eventPda, vaultStatePda, vaultTreasuryPda };
  };

  const findEventPassPda = (
    eventPda: PublicKey,
    attendee: PublicKey,
    tierId: number
  ) => {
    const [eventPassPda] = PublicKey.findProgramAddressSync(
      [PASS_SEED, eventPda.toBuffer(), attendee.toBuffer(), Buffer.from([tierId])],
      program.programId
    );
    return eventPassPda;
  };

  const findLoyaltyMintPda = (eventPassPda: PublicKey) => {
    const [mintPda] = PublicKey.findProgramAddressSync(
      [LOYALTY_MINT_SEED, eventPassPda.toBuffer()],
      program.programId
    );
    return mintPda;
  };

  const fundWallet = async (pubkey: PublicKey, amount = 2 * LAMPORTS_PER_SOL) => {
    const sig = await provider.connection.requestAirdrop(pubkey, amount);
    await provider.connection.confirmTransaction(sig);
  };

  const [adapterReservePda] = PublicKey.findProgramAddressSync(
    [ADAPTER_RESERVE_SEED],
    vaultStub.programId
  );

  const ensureAdapterInitialized = async () => {
    try {
      await vaultStub.methods
        .initialize()
        .accounts({
          adapter: adapterReservePda,
          authority: organizer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (err: any) {
      const anchorErr = anchor.AnchorError.parse(err);
      if (anchorErr?.error?.errorCode?.code !== "AccountAlreadyInitialized") {
        throw err;
      }
    }
  };

  const topUpAdapterReserve = async (amountLamports: number) => {
    await vaultStub.methods
      .fundReserve(new BN(amountLamports))
      .accounts({
        funder: organizer.publicKey,
        adapter: adapterReservePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  };

  before(async () => {
    await fundWallet(organizer.publicKey, 4 * LAMPORTS_PER_SOL);
    await ensureAdapterInitialized();
  });

  const buildEventArgs = (overrides: Record<string, any> = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const defaultTier = {
      tierId: 1,
      label: "VIP",
      priceLamports: new BN(LAMPORTS_PER_SOL / 10),
      maxSupply: 5,
    };

    return {
      eventId: overrides.eventId ?? randomEventId(),
      name: overrides.name ?? "EventFlux Summit",
      venue: overrides.venue ?? "Metropolis Arena",
      startTs: overrides.startTs ?? new BN(now - 600),
      endTs: overrides.endTs ?? new BN(now + 3600),
      settlementTreasury: overrides.settlementTreasury ?? organizer.publicKey,
      yieldStrategy: overrides.yieldStrategy ?? { none: {} },
      authorizedVerifiers: overrides.authorizedVerifiers ?? [],
      tiers: overrides.tiers ?? [defaultTier],
    } as any;
  };

  const createEventFixture = async (
    overrides: Record<string, any> = {}
  ) => {
    const args = buildEventArgs(overrides);
    const { eventPda, vaultStatePda, vaultTreasuryPda } = findEventPdas(
      organizer.publicKey,
      args.eventId
    );

    await program.methods
      .createEvent(args)
      .accounts({
        organizer: organizer.publicKey,
        event: eventPda,
        vaultState: vaultStatePda,
        vaultTreasury: vaultTreasuryPda,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    return { args, eventPda, vaultStatePda, vaultTreasuryPda };
  };

  const mintPass = async (
    fixture: Awaited<ReturnType<typeof createEventFixture>>,
    tierId: number,
    attendee: Keypair = Keypair.generate()
  ) => {
    await fundWallet(attendee.publicKey);
    const eventPassPda = findEventPassPda(
      fixture.eventPda,
      attendee.publicKey,
      tierId
    );

    await program.methods
      .mintPass(tierId)
      .accounts({
        attendee: attendee.publicKey,
        event: fixture.eventPda,
        vaultState: fixture.vaultStatePda,
        vaultTreasury: fixture.vaultTreasuryPda,
        eventPass: eventPassPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([attendee])
      .rpc();

    return { attendee, eventPassPda };
  };

  it("creates an event and mints passes into the vault", async () => {
    const fixture = await createEventFixture();
    const { eventPassPda, attendee } = await mintPass(fixture, 1);

    const eventAccount: any = await program.account.event.fetch(fixture.eventPda);
    assert.equal(eventAccount.totalPasses.toNumber(), 1);
    assert.equal(eventAccount.tiers[0].sold, 1);

    const vaultState: any = await program.account.vaultState.fetch(
      fixture.vaultStatePda
    );
    assert.equal(
      vaultState.totalDeposited.toNumber(),
      LAMPORTS_PER_SOL / 10
    );

    const passAccount: any = await program.account.eventPass.fetch(eventPassPda);
    assert.equal(passAccount.owner.toBase58(), attendee.publicKey.toBase58());
    assert.isFalse(passAccount.checkedIn);
  });

  it("prevents unauthorized or double check-ins", async () => {
    const verifier = Keypair.generate();
    await fundWallet(verifier.publicKey);
    const fixture = await createEventFixture({
      authorizedVerifiers: [verifier.publicKey],
    });
    const { eventPassPda, attendee } = await mintPass(fixture, 1);

    const randomVerifier = Keypair.generate();
    await fundWallet(randomVerifier.publicKey);

    try {
      await program.methods
        .checkIn()
        .accounts({
          verifier: randomVerifier.publicKey,
          event: fixture.eventPda,
          eventPass: eventPassPda,
        })
        .signers([randomVerifier])
        .rpc();
      assert.fail("Expected unauthorized verifier error");
    } catch (err: any) {
      expectAnchorError(err, "UnauthorizedVerifier");
    }

    await program.methods
      .checkIn()
      .accounts({
        verifier: verifier.publicKey,
        event: fixture.eventPda,
        eventPass: eventPassPda,
      })
      .signers([verifier])
      .rpc();

    const passAccount: any = await program.account.eventPass.fetch(eventPassPda);
    assert.isTrue(passAccount.checkedIn);

    try {
      await program.methods
        .checkIn()
        .accounts({
          verifier: attendee.publicKey,
          event: fixture.eventPda,
          eventPass: eventPassPda,
        })
        .signers([attendee])
        .rpc();
      assert.fail("Expected double check-in failure");
    } catch (err: any) {
      expectAnchorError(err, "AlreadyCheckedIn");
    }
  });

  it("withdraws treasury to the organizer after the event", async () => {
    const now = Math.floor(Date.now() / 1000);
    const fixture = await createEventFixture({
      startTs: new BN(now - 10),
      endTs: new BN(now + 2),
    });
    await mintPass(fixture, 1);

    await new Promise((resolve) => setTimeout(resolve, 2500));

    const destinationBefore = await provider.connection.getBalance(
      organizer.publicKey
    );

    await program.methods
      .withdrawTreasury()
      .accounts({
        organizer: organizer.publicKey,
        event: fixture.eventPda,
        vaultState: fixture.vaultStatePda,
        destination: organizer.publicKey,
        vaultTreasury: fixture.vaultTreasuryPda,
      })
      .rpc();

    const destinationAfter = await provider.connection.getBalance(
      organizer.publicKey
    );

    assert.isAbove(destinationAfter - destinationBefore, 0);
    const eventAccount: any = await program.account.event.fetch(fixture.eventPda);
    assert.isTrue(eventAccount.settled);
  });

  it("harvests yield via the vault adapter stub", async () => {
    const fixture = await createEventFixture({
      yieldStrategy: { kamino: {} },
    });
    await mintPass(fixture, 1);
    const harvestAmount = LAMPORTS_PER_SOL / 20;
    await topUpAdapterReserve(harvestAmount);

    const vaultBefore = await provider.connection.getBalance(
      fixture.vaultTreasuryPda
    );

    await program.methods
      .harvestYield(new BN(harvestAmount))
      .accounts({
        organizer: organizer.publicKey,
        event: fixture.eventPda,
        vaultState: fixture.vaultStatePda,
        vaultTreasury: fixture.vaultTreasuryPda,
        adapterReserve: adapterReservePda,
        vaultAdapterProgram: vaultStub.programId,
      })
      .rpc();

    const vaultAfter = await provider.connection.getBalance(
      fixture.vaultTreasuryPda
    );
    const vaultState: any = await program.account.vaultState.fetch(
      fixture.vaultStatePda
    );

    assert.equal(vaultAfter - vaultBefore, harvestAmount);
    assert.equal(vaultState.totalYieldHarvested.toNumber(), harvestAmount);
  });

  it("issues loyalty NFTs post check-in", async () => {
    const fixture = await createEventFixture({
      authorizedVerifiers: [organizer.publicKey],
    });
    const { attendee, eventPassPda } = await mintPass(fixture, 1);

    await program.methods
      .checkIn()
      .accounts({
        verifier: organizer.publicKey,
        event: fixture.eventPda,
        eventPass: eventPassPda,
      })
      .rpc();

    const loyaltyMintPda = findLoyaltyMintPda(eventPassPda);
    const ata = getAssociatedTokenAddressSync(
      loyaltyMintPda,
      attendee.publicKey
    );

    await program.methods
      .issueLoyaltyNft()
      .accounts({
        organizer: organizer.publicKey,
        event: fixture.eventPda,
        eventPass: eventPassPda,
        passOwner: attendee.publicKey,
        loyaltyMint: loyaltyMintPda,
        loyaltyTokenAccount: ata,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const passAccount: any = await program.account.eventPass.fetch(eventPassPda);
    assert.equal(passAccount.loyaltyMint.toBase58(), loyaltyMintPda.toBase58());

    const tokenAccount = await getAccount(provider.connection, ata);
    assert.equal(Number(tokenAccount.amount), 1);

    try {
      await program.methods
        .issueLoyaltyNft()
        .accounts({
          organizer: organizer.publicKey,
          event: fixture.eventPda,
          eventPass: eventPassPda,
          passOwner: attendee.publicKey,
          loyaltyMint: loyaltyMintPda,
          loyaltyTokenAccount: ata,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      assert.fail("Expected loyalty already issued error");
    } catch (err: any) {
      expectAnchorError(err, "LoyaltyAlreadyIssued");
    }
  });

  it("fails to mint once supply is exhausted", async () => {
    const fixture = await createEventFixture({
      tiers: [
        {
          tierId: 1,
          label: "GA",
          priceLamports: new BN(LAMPORTS_PER_SOL / 20),
          maxSupply: 1,
        },
      ],
    });

    await mintPass(fixture, 1);
    const lateAttendee = Keypair.generate();
    await fundWallet(lateAttendee.publicKey);
    const eventPassPda = findEventPassPda(
      fixture.eventPda,
      lateAttendee.publicKey,
      1
    );

    try {
      await program.methods
        .mintPass(1)
        .accounts({
          attendee: lateAttendee.publicKey,
          event: fixture.eventPda,
          vaultState: fixture.vaultStatePda,
          vaultTreasury: fixture.vaultTreasuryPda,
          eventPass: eventPassPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([lateAttendee])
        .rpc();
      assert.fail("Expected tier sold out error");
    } catch (err: any) {
      expectAnchorError(err, "TierSoldOut");
    }
  });
});
