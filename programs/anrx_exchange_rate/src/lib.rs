use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;


declare_id!("HZZ1t1XKJw7YepVxex3xKRcCiV1gU7v55GpGgrFnHxxy");

#[program]
pub mod anrx_exchange_rate {
    use super::*;

    pub fn initialize_exchange_rate(ctx: Context<InitializeExchangeRate>, bump: u8) -> Result<()> {
        
        let exchange_rate_account = &mut ctx.accounts.exchange_rate;
        exchange_rate_account.bump = bump; // ctx.bumps.exchange_rate;
        exchange_rate_account.rate = 0; // Initial rate set to 0
        exchange_rate_account.user = ctx.accounts.user.key();
        Ok(())
    }

    pub fn update_exchange_rate(
        ctx: Context<UpdateExchangeRate>,
        eur_usd_feed_id: [u8; 32],
        sol_usd_feed_id: [u8; 32],
    ) -> Result<()> {
        let maximum_age: u64 = 10;
          // Deserialize Pyth accounts manually
        let eur_usd_price_update_feed = PriceUpdateV2::try_from_slice(
            &ctx.accounts.eur_usd_price_update.try_borrow_data()?
        ).map_err(|_| ProgramError::InvalidAccountData)?;

        let sol_usd_price_update_feed = PriceUpdateV2::try_from_slice(
            &ctx.accounts.sol_usd_price_update.try_borrow_data()?
        ).map_err(|_| ProgramError::InvalidAccountData)?;

        let eur_usd_price = eur_usd_price_update_feed
            .get_price_no_older_than(&Clock::get()?, maximum_age, &eur_usd_feed_id)
            .map_err(|_| ErrorCode::InvalidPriceFeed)?;

        let sol_usd_price = sol_usd_price_update_feed
            .get_price_no_older_than(&Clock::get()?, maximum_age, &sol_usd_feed_id)
            .map_err(|_| ErrorCode::InvalidPriceFeed)?;
        let eur_to_sol = (eur_usd_price.price as f64 / sol_usd_price.price as f64) * 
                         10_f64.powi(eur_usd_price.exponent - sol_usd_price.exponent);

        ctx.accounts.exchange_rate.rate = (eur_to_sol * 1_000_000.0) as u64;

        Ok(())
    }

   
}

#[derive(Accounts)]
pub struct InitializeExchangeRate<'info> {
    #[account(
        init, 
        payer = user, 
        space = 8 + 8 + 32 + 1, 
        seeds = [b"exchange_rate", user.key().as_ref()], 
        bump
    )]
    pub exchange_rate: Account<'info, ExchangeRate>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateExchangeRate<'info> {
    #[account(
        mut, 
        seeds = [b"exchange_rate", user.key().as_ref()], 
        bump = exchange_rate.bump
    )]
    pub exchange_rate: Account<'info, ExchangeRate>,
    
    #[account(mut)]
     pub user: Signer<'info>,
     // EUR/USD and SOL/USD price update accounts from Pyth
     /// CHECK: Price feed account from Pyth, handled manually
     pub eur_usd_price_update:  UncheckedAccount<'info>,
     /// CHECK: Price feed account from Pyth, handled manually
     pub sol_usd_price_update:  UncheckedAccount<'info>,
}

#[account]
pub struct ExchangeRate {
    pub rate: u64,  // Stores the latest exchange rate
    pub user: Pubkey,  // The owner of this exchange rate account
    pub bump: u8,  // Bump seed for PDA verification
}




#[error_code]
pub enum ErrorCode {
    #[msg("Invalid or outdated price feed data.")]
    InvalidPriceFeed,
}