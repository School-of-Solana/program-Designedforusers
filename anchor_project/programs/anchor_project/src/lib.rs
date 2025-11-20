use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke_signed, system_instruction},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, MintTo, Token, TokenAccount},
};
use vault_stub::{self, ADAPTER_RESERVE_SEED};

declare_id!("Akk9YtTtkqG9K8PdbqtKd2k6zDF2egc8xnkdMWD2nvaU");

const EVENT_SEED: &[u8] = b"event";
const PASS_SEED: &[u8] = b"event-pass";
const VAULT_STATE_SEED: &[u8] = b"vault-state";
const VAULT_TREASURY_SEED: &[u8] = b"vault-treasury";
const LOYALTY_MINT_SEED: &[u8] = b"loyalty-mint";

const MAX_TIER_COUNT: usize = 4;
const MAX_VERIFIER_COUNT: usize = 5;
const MAX_NAME_LEN: usize = 64;
const MAX_VENUE_LEN: usize = 64;
const MAX_TIER_LABEL_LEN: usize = 32;

#[program]
pub mod anchor_project {
    use super::*;

    pub fn create_event(ctx: Context<CreateEvent>, args: CreateEventArgs) -> Result<()> {
        args.validate()?;

        let CreateEventArgs {
            event_id,
            name,
            venue,
            start_ts,
            end_ts,
            settlement_treasury,
            yield_strategy,
            authorized_verifiers,
            tiers,
        } = args;

        let event = &mut ctx.accounts.event;
        event.bump = ctx.bumps.event;
        event.event_id = event_id;
        event.organizer = ctx.accounts.organizer.key();
        event.settlement_treasury = settlement_treasury;
        event.name = name;
        event.venue = venue;
        event.start_ts = start_ts;
        event.end_ts = end_ts;
        event.yield_strategy = yield_strategy;
        event.authorized_verifiers = authorized_verifiers;
        event.tiers = tiers
            .into_iter()
            .map(TierConfig::from_input)
            .collect::<Result<Vec<_>>>()?;
        event.total_passes = 0;
        event.vault_state = ctx.accounts.vault_state.key();
        event.settled = false;

        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.bump = ctx.bumps.vault_state;
        vault_state.event = event.key();
        vault_state.strategy = event.yield_strategy.clone();
        vault_state.total_deposited = 0;
        vault_state.total_withdrawn = 0;
        vault_state.total_yield_harvested = 0;
        vault_state.vault_treasury_bump = ctx.bumps.vault_treasury;
        vault_state.last_harvest_ts = 0;

        let event_key = event.key();
        let signer_seeds: &[&[u8]] = &[
            VAULT_TREASURY_SEED,
            event_key.as_ref(),
            &[vault_state.vault_treasury_bump],
        ];

        create_vault_treasury_if_needed(
            &ctx.accounts.organizer,
            &ctx.accounts.vault_treasury,
            ctx.accounts.rent.minimum_balance(0),
            &ctx.accounts.system_program,
            signer_seeds,
        )?;

        Ok(())
    }

    pub fn mint_pass(ctx: Context<MintPass>, tier_id: u8) -> Result<()> {
        let event = &mut ctx.accounts.event;
        let vault_state = &mut ctx.accounts.vault_state;
        let now = Clock::get()?.unix_timestamp;

        require!(now < event.end_ts, EventFluxError::EventEnded);

        let tier_price = {
            let tier = event
                .tiers
                .iter_mut()
                .find(|t| t.tier_id == tier_id)
                .ok_or(EventFluxError::TierNotFound)?;

            require!(tier.sold < tier.max_supply, EventFluxError::TierSoldOut);

            tier.sold = tier
                .sold
                .checked_add(1)
                .ok_or(EventFluxError::MathOverflow)?;
            tier.price_lamports
        };

        event.total_passes = event
            .total_passes
            .checked_add(1)
            .ok_or(EventFluxError::MathOverflow)?;

        let event_pass = &mut ctx.accounts.event_pass;
        event_pass.bump = ctx.bumps.event_pass;
        event_pass.event = event.key();
        event_pass.owner = ctx.accounts.attendee.key();
        event_pass.tier_id = tier_id;
        event_pass.price_paid = tier_price;
        event_pass.minted_at = now;
        event_pass.checked_in = false;
        event_pass.checked_in_at = None;
        event_pass.loyalty_mint = None;

        invoke_signed(
            &system_instruction::transfer(
                &ctx.accounts.attendee.key(),
                &ctx.accounts.vault_treasury.key(),
                tier_price,
            ),
            &[
                ctx.accounts.attendee.to_account_info(),
                ctx.accounts.vault_treasury.to_account_info(),
            ],
            &[],
        )?;

        vault_state.total_deposited = vault_state
            .total_deposited
            .checked_add(tier_price)
            .ok_or(EventFluxError::MathOverflow)?;

        Ok(())
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        let event = &ctx.accounts.event;
        let event_pass = &mut ctx.accounts.event_pass;
        let now = Clock::get()?.unix_timestamp;

        require!(now >= event.start_ts, EventFluxError::EventNotStarted);
        require!(now <= event.end_ts, EventFluxError::EventEnded);

        let verifier = ctx.accounts.verifier.key();
        let is_authorized = verifier == event.organizer
            || event.authorized_verifiers.iter().any(|v| v == &verifier)
            || verifier == event_pass.owner;
        require!(is_authorized, EventFluxError::UnauthorizedVerifier);
        require!(!event_pass.checked_in, EventFluxError::AlreadyCheckedIn);

        event_pass.checked_in = true;
        event_pass.checked_in_at = Some(now);

        Ok(())
    }

    pub fn withdraw_treasury(ctx: Context<WithdrawTreasury>) -> Result<()> {
        let event = &mut ctx.accounts.event;
        let vault_state = &mut ctx.accounts.vault_state;

        require!(!event.settled, EventFluxError::AlreadySettled);
        require!(
            Clock::get()?.unix_timestamp >= event.end_ts,
            EventFluxError::EventNotEnded
        );

        let balance = ctx.accounts.vault_treasury.lamports();
        require!(balance > 0, EventFluxError::NothingToWithdraw);

        **ctx
            .accounts
            .vault_treasury
            .to_account_info()
            .try_borrow_mut_lamports()? -= balance;
        **ctx
            .accounts
            .destination
            .to_account_info()
            .try_borrow_mut_lamports()? += balance;

        vault_state.total_withdrawn = vault_state
            .total_withdrawn
            .checked_add(balance)
            .ok_or(EventFluxError::MathOverflow)?;
        event.settled = true;

        Ok(())
    }

    pub fn harvest_yield(ctx: Context<HarvestYield>, amount: u64) -> Result<()> {
        require!(amount > 0, EventFluxError::InvalidHarvestAmount);

        let event = &ctx.accounts.event;
        require_keys_eq!(ctx.accounts.organizer.key(), event.organizer);
        require!(!event.settled, EventFluxError::AlreadySettled);
        require!(
            !matches!(event.yield_strategy, YieldStrategy::None),
            EventFluxError::NoYieldStrategy,
        );

        let cpi_ctx = CpiContext::new(
            ctx.accounts.vault_adapter_program.to_account_info(),
            vault_stub::cpi::accounts::Harvest {
                adapter: ctx.accounts.adapter_reserve.to_account_info(),
                destination: ctx.accounts.vault_treasury.to_account_info(),
            },
        );

        vault_stub::cpi::harvest(cpi_ctx, amount)?;

        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.total_yield_harvested = vault_state
            .total_yield_harvested
            .checked_add(amount)
            .ok_or(EventFluxError::MathOverflow)?;
        vault_state.last_harvest_ts = Clock::get()?.unix_timestamp;

        Ok(())
    }

    pub fn issue_loyalty_nft(ctx: Context<IssueLoyaltyNft>) -> Result<()> {
        let event_pass = &mut ctx.accounts.event_pass;

        require!(event_pass.checked_in, EventFluxError::PassNotCheckedIn);
        require!(
            event_pass.loyalty_mint.is_none(),
            EventFluxError::LoyaltyAlreadyIssued
        );

        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.loyalty_mint.to_account_info(),
                    to: ctx.accounts.loyalty_token_account.to_account_info(),
                    authority: ctx.accounts.organizer.to_account_info(),
                },
            ),
            1,
        )?;

        event_pass.loyalty_mint = Some(ctx.accounts.loyalty_mint.key());

        Ok(())
    }
}

fn create_vault_treasury_if_needed<'info>(
    payer: &Signer<'info>,
    vault_treasury: &UncheckedAccount<'info>,
    rent: u64,
    system_program: &Program<'info, System>,
    signer_seeds: &[&[u8]],
) -> Result<()> {
    if vault_treasury.to_account_info().owner == &crate::ID {
        return Ok(());
    }

    let ix = system_instruction::create_account(
        &payer.key(),
        &vault_treasury.key(),
        rent,
        0,
        &crate::ID,
    );

    invoke_signed(
        &ix,
        &[
            payer.to_account_info(),
            vault_treasury.to_account_info(),
            system_program.to_account_info(),
        ],
        &[signer_seeds],
    )
    .map_err(|_| error!(EventFluxError::VaultCreationFailed))?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(args: CreateEventArgs)]
pub struct CreateEvent<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    #[account(
        init,
        payer = organizer,
        space = Event::size_with_args(&args),
        seeds = [EVENT_SEED, organizer.key().as_ref(), &args.event_id.to_le_bytes()],
        bump,
    )]
    pub event: Account<'info, Event>,
    #[account(
        init,
        payer = organizer,
        space = VaultState::SPACE,
        seeds = [VAULT_STATE_SEED, event.key().as_ref()],
        bump,
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(
        mut,
        seeds = [VAULT_TREASURY_SEED, event.key().as_ref()],
        bump,
    )]
    /// CHECK: derived PDA that temporarily stores ticket proceeds, only accessed within program
    pub vault_treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(tier_id: u8)]
pub struct MintPass<'info> {
    #[account(mut)]
    pub attendee: Signer<'info>,
    #[account(
        mut,
        seeds = [EVENT_SEED, event.organizer.as_ref(), &event.event_id.to_le_bytes()],
        bump = event.bump,
    )]
    pub event: Account<'info, Event>,
    #[account(
        mut,
        seeds = [VAULT_STATE_SEED, event.key().as_ref()],
        bump = vault_state.bump,
        constraint = vault_state.event == event.key(),
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(
        mut,
        seeds = [VAULT_TREASURY_SEED, event.key().as_ref()],
        bump = vault_state.vault_treasury_bump,
    )]
    /// CHECK: lamports-only PDA controlled by this program
    pub vault_treasury: UncheckedAccount<'info>,
    #[account(
        init,
        payer = attendee,
        space = EventPass::SPACE,
        seeds = [PASS_SEED, event.key().as_ref(), attendee.key().as_ref(), &[tier_id]],
        bump,
    )]
    pub event_pass: Account<'info, EventPass>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckIn<'info> {
    pub verifier: Signer<'info>,
    #[account(
        seeds = [EVENT_SEED, event.organizer.as_ref(), &event.event_id.to_le_bytes()],
        bump = event.bump,
    )]
    pub event: Account<'info, Event>,
    #[account(
        mut,
        seeds = [PASS_SEED, event.key().as_ref(), event_pass.owner.as_ref(), &[event_pass.tier_id]],
        bump = event_pass.bump,
        constraint = event_pass.event == event.key(),
    )]
    pub event_pass: Account<'info, EventPass>,
}

#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
    pub organizer: Signer<'info>,
    #[account(
        mut,
        seeds = [EVENT_SEED, event.organizer.as_ref(), &event.event_id.to_le_bytes()],
        bump = event.bump,
        constraint = event.organizer == organizer.key(),
    )]
    pub event: Account<'info, Event>,
    #[account(
        mut,
        seeds = [VAULT_STATE_SEED, event.key().as_ref()],
        bump = vault_state.bump,
        constraint = vault_state.event == event.key(),
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(mut, address = event.settlement_treasury)]
    pub destination: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [VAULT_TREASURY_SEED, event.key().as_ref()],
        bump = vault_state.vault_treasury_bump,
    )]
    /// CHECK: settlement PDA scoped to this event, drained at withdrawal
    pub vault_treasury: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct HarvestYield<'info> {
    pub organizer: Signer<'info>,
    #[account(
        seeds = [EVENT_SEED, event.organizer.as_ref(), &event.event_id.to_le_bytes()],
        bump = event.bump,
        constraint = event.organizer == organizer.key(),
    )]
    pub event: Account<'info, Event>,
    #[account(
        mut,
        seeds = [VAULT_STATE_SEED, event.key().as_ref()],
        bump = vault_state.bump,
        constraint = vault_state.event == event.key(),
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(
        mut,
        seeds = [VAULT_TREASURY_SEED, event.key().as_ref()],
        bump = vault_state.vault_treasury_bump,
    )]
    /// CHECK: PDA receiving harvested yield before settlement
    pub vault_treasury: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [ADAPTER_RESERVE_SEED],
        seeds::program = vault_stub::ID,
        bump = adapter_reserve.bump,
    )]
    pub adapter_reserve: Account<'info, vault_stub::AdapterReserve>,
    #[account(address = vault_stub::ID)]
    pub vault_adapter_program: Program<'info, vault_stub::program::VaultStub>,
}

#[derive(Accounts)]
pub struct IssueLoyaltyNft<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    #[account(
        seeds = [EVENT_SEED, event.organizer.as_ref(), &event.event_id.to_le_bytes()],
        bump = event.bump,
        constraint = event.organizer == organizer.key(),
    )]
    pub event: Account<'info, Event>,
    #[account(
        mut,
        seeds = [PASS_SEED, event.key().as_ref(), event_pass.owner.as_ref(), &[event_pass.tier_id]],
        bump = event_pass.bump,
        constraint = event_pass.event == event.key(),
    )]
    pub event_pass: Account<'info, EventPass>,
    /// CHECK: ensures minted token authority matches pass owner
    #[account(address = event_pass.owner)]
    pub pass_owner: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = organizer,
        seeds = [LOYALTY_MINT_SEED, event_pass.key().as_ref()],
        bump,
        mint::decimals = 0,
        mint::authority = organizer,
    )]
    pub loyalty_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = organizer,
        associated_token::mint = loyalty_mint,
        associated_token::authority = pass_owner,
    )]
    pub loyalty_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
pub struct Event {
    pub bump: u8,
    pub event_id: u64,
    pub organizer: Pubkey,
    pub settlement_treasury: Pubkey,
    pub name: String,
    pub venue: String,
    pub start_ts: i64,
    pub end_ts: i64,
    pub yield_strategy: YieldStrategy,
    pub tiers: Vec<TierConfig>,
    pub authorized_verifiers: Vec<Pubkey>,
    pub total_passes: u64,
    pub vault_state: Pubkey,
    pub settled: bool,
}

impl Event {
    pub fn size_with_args(args: &CreateEventArgs) -> usize {
        8 + // discriminator
        1 + // bump
        8 + // event_id
        32 + // organizer
        32 + // settlement treasury
        8 + 8 + // timestamps
        1 + // strategy enum
        32 + // vault state
        8 + // total passes
        1 + // settled
        4 + args.name.len() +
        4 + args.venue.len() +
        4 + args.authorized_verifiers.len() * 32 +
        TierConfig::space_for_inputs(&args.tiers)
    }
}

#[account]
pub struct EventPass {
    pub bump: u8,
    pub event: Pubkey,
    pub owner: Pubkey,
    pub tier_id: u8,
    pub price_paid: u64,
    pub minted_at: i64,
    pub checked_in: bool,
    pub checked_in_at: Option<i64>,
    pub loyalty_mint: Option<Pubkey>,
}

impl EventPass {
    pub const SPACE: usize = 8 // discriminator
        + 1 // bump
        + 32 // event
        + 32 // owner
        + 1 // tier
        + 8 // price
        + 8 // minted_at
        + 1 // checked_in
        + 1 // check-in option flag
        + 8 // check-in timestamp
        + 1 // loyalty option flag
        + 32; // loyalty mint pubkey
}

#[account]
pub struct VaultState {
    pub bump: u8,
    pub event: Pubkey,
    pub strategy: YieldStrategy,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub total_yield_harvested: u64,
    pub vault_treasury_bump: u8,
    pub last_harvest_ts: i64,
}

impl VaultState {
    pub const SPACE: usize = 8 // discriminator
        + 1 // bump
        + 32 // event
        + 1 // strategy enum
        + 8 // deposited
        + 8 // withdrawn
        + 8 // total yield
        + 1 // treasury bump
        + 8; // last harvest
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub enum YieldStrategy {
    None,
    Kamino,
    Sanctum,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct TierConfig {
    pub tier_id: u8,
    pub label: String,
    pub price_lamports: u64,
    pub max_supply: u32,
    pub sold: u32,
}

impl TierConfig {
    pub fn from_input(input: TierInput) -> Result<Self> {
        require!(
            input.label.len() <= MAX_TIER_LABEL_LEN,
            EventFluxError::TierLabelTooLong
        );
        Ok(Self {
            tier_id: input.tier_id,
            label: input.label,
            price_lamports: input.price_lamports,
            max_supply: input.max_supply,
            sold: 0,
        })
    }

    pub fn space_for_inputs(inputs: &[TierInput]) -> usize {
        4 + inputs
            .iter()
            .map(|input| 1 + 4 + input.label.len() + 8 + 4 + 4)
            .sum::<usize>()
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct TierInput {
    pub tier_id: u8,
    pub label: String,
    pub price_lamports: u64,
    pub max_supply: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct CreateEventArgs {
    pub event_id: u64,
    pub name: String,
    pub venue: String,
    pub start_ts: i64,
    pub end_ts: i64,
    pub settlement_treasury: Pubkey,
    pub yield_strategy: YieldStrategy,
    pub authorized_verifiers: Vec<Pubkey>,
    pub tiers: Vec<TierInput>,
}

impl CreateEventArgs {
    pub fn validate(&self) -> Result<()> {
        require!(!self.name.is_empty(), EventFluxError::InvalidMetadata);
        require!(!self.venue.is_empty(), EventFluxError::InvalidMetadata);
        require!(
            self.name.len() <= MAX_NAME_LEN,
            EventFluxError::MetadataTooLong
        );
        require!(
            self.venue.len() <= MAX_VENUE_LEN,
            EventFluxError::MetadataTooLong
        );
        require!(self.start_ts < self.end_ts, EventFluxError::InvalidSchedule);
        require!(!self.tiers.is_empty(), EventFluxError::InvalidTierSet);
        require!(
            self.tiers.len() <= MAX_TIER_COUNT,
            EventFluxError::TooManyTiers
        );
        require!(
            self.authorized_verifiers.len() <= MAX_VERIFIER_COUNT,
            EventFluxError::TooManyVerifiers
        );
        Ok(())
    }
}

#[error_code]
pub enum EventFluxError {
    #[msg("Bump not found")]
    BumpNotFound,
    #[msg("Event already concluded")]
    EventEnded,
    #[msg("Tier not found")]
    TierNotFound,
    #[msg("Tier sold out")]
    TierSoldOut,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Event has not started")]
    EventNotStarted,
    #[msg("Unauthorized verifier")]
    UnauthorizedVerifier,
    #[msg("Pass already checked in")]
    AlreadyCheckedIn,
    #[msg("Event already settled")]
    AlreadySettled,
    #[msg("Event not ended")]
    EventNotEnded,
    #[msg("No funds to withdraw")]
    NothingToWithdraw,
    #[msg("Invalid metadata")]
    InvalidMetadata,
    #[msg("Metadata too long")]
    MetadataTooLong,
    #[msg("Invalid event schedule")]
    InvalidSchedule,
    #[msg("Invalid tier configuration")]
    InvalidTierSet,
    #[msg("Too many tiers supplied")]
    TooManyTiers,
    #[msg("Too many verifiers supplied")]
    TooManyVerifiers,
    #[msg("Tier label too long")]
    TierLabelTooLong,
    #[msg("Unable to create vault treasury")]
    VaultCreationFailed,
    #[msg("Cannot harvest yield for events without a strategy")]
    NoYieldStrategy,
    #[msg("Harvest amount must be positive")]
    InvalidHarvestAmount,
    #[msg("Pass must be checked in before loyalty rewards")]
    PassNotCheckedIn,
    #[msg("Loyalty NFT already issued for this pass")]
    LoyaltyAlreadyIssued,
}
