use anchor_lang::{
    prelude::*,
    solana_program::{program::invoke, system_instruction},
};

declare_id!("9zDeQgUTkwW1X2xW9ZZcACToGt9Lzoz1nAm88PtMu912");

pub const ADAPTER_RESERVE_SEED: &[u8] = b"adapter-reserve";

#[program]
pub mod vault_stub {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.adapter.bump = ctx.bumps.adapter;
        Ok(())
    }

    pub fn fund_reserve(ctx: Context<FundReserve>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultStubError::InvalidAmount);

        let ix = system_instruction::transfer(
            &ctx.accounts.funder.key(),
            &ctx.accounts.adapter.key(),
            amount,
        );

        invoke(
            &ix,
            &[
                ctx.accounts.funder.to_account_info(),
                ctx.accounts.adapter.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        Ok(())
    }

    pub fn harvest(ctx: Context<Harvest>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultStubError::InvalidAmount);

        let adapter_info = ctx.accounts.adapter.to_account_info();
        let destination_info = ctx.accounts.destination.to_account_info();

        require!(
            adapter_info.lamports() >= amount,
            VaultStubError::InsufficientReserve
        );

        **adapter_info.try_borrow_mut_lamports()? -= amount;
        **destination_info.try_borrow_mut_lamports()? += amount;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = AdapterReserve::SPACE,
        seeds = [ADAPTER_RESERVE_SEED],
        bump,
    )]
    pub adapter: Account<'info, AdapterReserve>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundReserve<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,
    #[account(
        mut,
        seeds = [ADAPTER_RESERVE_SEED],
        bump = adapter.bump,
    )]
    pub adapter: Account<'info, AdapterReserve>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Harvest<'info> {
    #[account(
        mut,
        seeds = [ADAPTER_RESERVE_SEED],
        bump = adapter.bump,
    )]
    pub adapter: Account<'info, AdapterReserve>,
    /// CHECK: destination is validated by the calling program
    #[account(mut)]
    pub destination: AccountInfo<'info>,
}

#[account]
pub struct AdapterReserve {
    pub bump: u8,
}

impl AdapterReserve {
    pub const SPACE: usize = 8 + 1;
}

#[error_code]
pub enum VaultStubError {
    #[msg("Adapter bump missing")]
    BumpMissing,
    #[msg("Provided amount must be greater than zero")]
    InvalidAmount,
    #[msg("Not enough funds in the adapter reserve")]
    InsufficientReserve,
}
