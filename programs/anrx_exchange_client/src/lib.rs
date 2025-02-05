use anchor_lang::prelude::*;
use solana_program::pubkey::Pubkey;
use solana_client::rpc_client::RpcClient;
use pyth_sdk_solana::state::load_price_account;
use std::str::FromStr;

declare_id!("7tRD147XfBvQX1vPXeWZ6X3ov2n2oDqP1HT1pDA5LFhM");

#[program]
pub mod anrx_exchange_client {
    use super::*;

    pub fn fetch_pyth_price(ctx: Context<FetchPrice>, pyth_price_feed: Pubkey) -> Result<()> {
        let rpc_url = "https://api.mainnet-beta.solana.com";
        let rpc_client = RpcClient::new(rpc_url.to_string());

        // Fetch account data from PythNet
        let account_data = rpc_client.get_account_data(&pyth_price_feed).map_err(|_| error!(ErrorCode::FetchError))?;
        
        // Parse the Pyth price account
        let price_account = load_price_account(&account_data).map_err(|_| error!(ErrorCode::InvalidPriceAccount))?;
        let price = price_account.agg.price as f64 / 10f64.powi(price_account.expo);

        msg!("Pyth Price Feed: {:?}", price);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct FetchPrice<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Failed to fetch price feed.")]
    FetchError,
    #[msg("Invalid Pyth price account.")]
    InvalidPriceAccount,
}
