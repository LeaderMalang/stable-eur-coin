use anchor_lang::prelude::*;
//  ---------------------------- JOEL --------
// use solana_sdk::{
//     pubkey::Pubkey as Web3Pubkey,
//     signature::Keypair as Web3Keypair,
// };
// use std::fs::File;
// use std::io::Write;
//se serde;
//  ---------------------------- JOEL --------
use anchor_lang::solana_program::system_instruction;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, update_metadata_accounts_v2, CreateMetadataAccountsV3,
        Metadata as Metaplex, UpdateMetadataAccountsV2,
    },
    token::{
        burn, mint_to, set_authority, transfer, Burn, Mint, MintTo, SetAuthority, Token,
        TokenAccount, Transfer,
    },
};

use anchor_spl::metadata::mpl_token_metadata::types::DataV2;
// use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use anrx_exchange_rate::cpi::accounts::UpdateExchangeRate;
use anrx_exchange_rate::program::AnrxExchangeRate;
use anrx_exchange_rate::{self, ExchangeRate};
use solana_program::pubkey::Pubkey;
use spl_token::instruction::AuthorityType;
use std::str::FromStr;
pub mod instructions;
pub mod utils;
pub use instructions::*;
pub use utils::*;
declare_id!("FQKhaRkCJsjC376Fz9VRNQ7qnuQJsBzyewRYU4cQFPhE");

#[program]
mod anrx_eur_coin {
    use super::*;
    /// Initializes a new token with metadata, including name, symbol, and URI.
    pub fn init_token(ctx: Context<InitToken>, metadata: InitTokenParams) -> Result<()> {
        // --------------------------- JOEL --------- MINT KEYPAIRS LOGIC ----------------------------
        // Generate the mint keypair
        // let mint_keypair: Web3Keypair = Web3Keypair::new();
        // let mint_pubkey: Web3Pubkey = mint_keypair.pubkey();

        // // Save the mint keypair to a file
        // let keypair_file = "mint_keypair.json";
        // let serialized_keypair = serde::to_string(&mint_keypair.to_bytes()).expect("Failed to serialize keypair");
        // let mut file = File::create(keypair_file).expect("Failed to create keypair file");
        // file.write_all(serialized_keypair.as_bytes())
        //     .expect("Failed to write keypair to file");

        // msg!("Mint keypair saved to {}", keypair_file);
        // ---------------------------- JOEL -------- MINT KEYPAIRS LOGIC ----------------------------

        let seeds = &["mint".as_bytes(), &[ctx.bumps.mint]];
        let signer = [&seeds[..]];

        let token_data: DataV2 = DataV2 {
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };
        // -------------------------------------------------------------------------
        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                payer: ctx.accounts.payer.to_account_info(),
                update_authority: ctx.accounts.payer.to_account_info(), // JOEL: "payer" instead "mint"
                mint: ctx.accounts.mint.to_account_info(),
                metadata: ctx.accounts.metadata.to_account_info(),
                mint_authority: ctx.accounts.payer.to_account_info(), // JOEL "payer" instead "mint"
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            &signer,
        );

        create_metadata_accounts_v3(metadata_ctx, token_data, true, true, None)?; // TODO: JOEL (metadata_ctx, token_data, true, false, None)

        //msg!("Token mint created successfully.");

        Ok(())
    }
    /// Updates the mint authority for the token.
    pub fn revoke_mint_authority(ctx: Context<RevokeMintAuthority>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.update_authority.key(),
            ctx.accounts.mint.mint_authority.unwrap(),
            ErrorCode::UnauthorizedAccess
        );

        // Update the mint authority
        set_authority(
            ctx.accounts.into_set_authority_context(),
            AuthorityType::MintTokens,
            None,
        )?;

        Ok(())
    }

    /// Mints new tokens and assigns them to the destination account.
    pub fn mint_tokens(ctx: Context<MintTokens>, quantity: u64) -> Result<()> {
        let seeds = &["mint".as_bytes(), &[ctx.bumps.mint]];
        let signer = [&seeds[..]];

        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    authority: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                },
                &signer,
            ),
            quantity,
        )?;

        Ok(())
    }

    /// Burns tokens from the specified account for emergency use cases.
    pub fn emergency_burn(ctx: Context<EmergencyBurn>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.admin.key() == ctx.accounts.burn_account.key(),
            ErrorCode::UnauthorizedAccess
        );
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.burn_account.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            amount,
        )?;

        Ok(())
    }
    /// Processes purchases with a fee and distributes the fees to specified accounts.
    pub fn purchase_with_fee(ctx: Context<PurchaseWithFee>, amount: u64) -> Result<()> {
        // Devnnet
        let eur_usd_feed_id_str = "Fu76ChamBDjE8UuGLV6GP2AcPPSU6gjhkNhAyuoPm7ny";
        let sol_usd_feed_id_str = "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE";

        // Mainnet
        // let eur_usd_feed_id_str= "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b";
        // let sol_usd_feed_id_str= "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

        // Convert string public keys to Pubkey
        let eur_usd_feed_id = Pubkey::from_str(&eur_usd_feed_id_str)
            .map_err(|_| ProgramError::InvalidArgument)?
            .to_bytes();

        let sol_usd_feed_id = Pubkey::from_str(&sol_usd_feed_id_str)
            .map_err(|_| ProgramError::InvalidArgument)?
            .to_bytes();
        // Step 1: Update exchange rate using CPI
        anrx_exchange_rate::cpi::update_exchange_rate(
            ctx.accounts.update_exchange_ctx(),
            eur_usd_feed_id,
            sol_usd_feed_id,
        )?;

        let exchange_rate_account = &ctx.accounts.exchange_rate;
        let eur_to_sol_rate = exchange_rate_account.rate as f64 / 1_000_000.0;
        let nominal_value_in_sol = amount as f64 * eur_to_sol_rate;

        // Calculate total transaction cost
        let total_cost = nominal_value_in_sol * 1.03;

        // Extract fees
        let liquidity_amount = nominal_value_in_sol; // Reserve €1 (or 1 SOL equivalent)
        let fee = total_cost - liquidity_amount;

        let fee_config = &ctx.accounts.fee_config;

        // Split the fees
        let validator_fee = (fee * fee_config.validator_share as f64) / 10_000.0; // 33.33%
        let admin_fee = (fee * fee_config.admin_share as f64) / 10_000.0; // 16.67%
        let partner_a_fee = (fee * fee_config.partner_a_share as f64) / 10_000.0; // 16.67%
        let partner_b_fee = (fee * fee_config.partner_b_share as f64) / 10_000.0; // 16.67%
        let partner_c_fee = (fee * fee_config.partner_c_share as f64) / 10_000.0; // 16.67%
        let partner_d_fee = (fee * fee_config.partner_d_share as f64) / 10_000.0; // 16.67%
                                                                                  // Transfer liquidity amount to the liquidity reserve account

        let liquidity_instruction = system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &ctx.accounts.liquidity_account.key(),
            liquidity_amount as u64,
        );
        anchor_lang::solana_program::program::invoke(
            &liquidity_instruction,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.liquidity_account.to_account_info(),
            ],
        )?;

        // Transfer fees to respective accounts

        let validator_instruction = system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &ctx.accounts.validator_account.key(),
            validator_fee as u64,
        );
        anchor_lang::solana_program::program::invoke(
            &validator_instruction,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.validator_account.to_account_info(),
            ],
        )?;

        let admin_instruction = system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &ctx.accounts.admin_account.key(),
            admin_fee as u64,
        );
        anchor_lang::solana_program::program::invoke(
            &admin_instruction,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.admin_account.to_account_info(),
            ],
        )?;

        let partner_a_account = &ctx.accounts.partner_a_account;
        let partner_b_account = &ctx.accounts.partner_b_account;
        let partner_c_account = &ctx.accounts.partner_c_account;
        let partner_d_account = &ctx.accounts.partner_d_account;
        // partner a account transfer instruction
        let transfer_instruction = system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &partner_a_account.key(),
            partner_a_fee as u64,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.payer.to_account_info(),
                partner_a_account.to_account_info(),
            ],
        )?;
        // partner b account transfer instruction
        let transfer_instruction = system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &partner_b_account.key(),
            partner_b_fee as u64,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.payer.to_account_info(),
                partner_b_account.to_account_info(),
            ],
        )?;
        // partner c account transfer instruction
        let transfer_instruction = system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &partner_c_account.key(),
            partner_c_fee as u64,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.payer.to_account_info(),
                partner_c_account.to_account_info(),
            ],
        )?;
        // partner d account transfer instruction
        let transfer_instruction = system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &partner_d_account.key(),
            partner_d_fee as u64,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.payer.to_account_info(),
                partner_d_account.to_account_info(),
            ],
        )?;

        Ok(())
    }
    // P2P Transfer without fees
    pub fn p2p_transfer(ctx: Context<P2PTransfer>, amount: u64) -> Result<()> {
        // Devnnet
        let eur_usd_feed_id_str = "Fu76ChamBDjE8UuGLV6GP2AcPPSU6gjhkNhAyuoPm7ny";
        let sol_usd_feed_id_str = "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE";

        // Mainnet
        // let eur_usd_feed_id_str= "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b";
        // let sol_usd_feed_id_str= "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

        // Convert string public keys to Pubkey
        let eur_usd_feed_id = Pubkey::from_str(&eur_usd_feed_id_str)
            .map_err(|_| ProgramError::InvalidArgument)?
            .to_bytes();

        let sol_usd_feed_id = Pubkey::from_str(&sol_usd_feed_id_str)
            .map_err(|_| ProgramError::InvalidArgument)?
            .to_bytes();
        // Step 1: Update exchange rate using CPI
        anrx_exchange_rate::cpi::update_exchange_rate(
            ctx.accounts.update_exchange_ctx(),
            eur_usd_feed_id,
            sol_usd_feed_id,
        )?;
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.sender_account.to_account_info(),
                    to: ctx.accounts.recipient_account.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            amount,
        )?;

        Ok(())
    }

    // }

    /// Updates the metadata of the token.
    pub fn update_metadata(
        ctx: Context<UpdateMetadata>,
        new_update_authority: Pubkey,
        metadata: NewMetadata,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.update_authority.key(),
            ctx.accounts.metadata.key(),
            ErrorCode::UnauthorizedAccess
        );
        let token_data: DataV2 = DataV2 {
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };
        let metadata_ctx = CpiContext::new(
            ctx.accounts.token_metadata_program.to_account_info(),
            UpdateMetadataAccountsV2 {
                metadata: ctx.accounts.metadata.to_account_info(),
                update_authority: ctx.accounts.update_authority.to_account_info(),
            },
        );

        update_metadata_accounts_v2(
            metadata_ctx,
            None, // Some(new_update_authority.key()), // No need
            Some(token_data),
            Some(false),
            Some(true),
        )?;

        Ok(())
    }

    // pub fn update_transfer_fee(ctx: Context<UpdateTransferFee>, new_fee: u16) -> Result<()> {
    //     let transfer_fee: &mut Account<'_, TransferFeeConfig> = &mut ctx.accounts.transfer_fee_config;
    //     transfer_fee.fee_percentage = new_fee;
    //     //msg!("Transfer fee updated to {}%.", new_fee);
    //     Ok(())
    // }
    /// Initializes the fee configuration with custom share distributions.
    pub fn initialize_fee_config(
        ctx: Context<InitializeFeeConfig>,
        total_fee: u64,
        validator_share: u64,
        admin_share: u64,
        partner_a_share: u64,
        partner_b_share: u64,
        partner_c_share: u64,
        partner_d_share: u64,
    ) -> Result<()> {
        let fee_config = &mut ctx.accounts.fee_config;

        fee_config.total_fee = total_fee;
        fee_config.validator_share = validator_share;
        fee_config.admin_share = admin_share;
        fee_config.partner_a_share = partner_a_share;

        fee_config.partner_b_share = partner_b_share;
        fee_config.partner_c_share = partner_c_share;
        fee_config.partner_d_share = partner_d_share;
        //fee_config.admin_share =ctx.accounts.admin.key();

        //msg!("FeeConfig initialized.");
        Ok(())
    }
    pub fn create_mint_account(
        ctx: Context<CreateMintAccount>,
        args: CreateMintAccountArgs,
    ) -> Result<()> {
        instructions::handler(ctx, args)
    }

    pub fn check_mint_extensions_constraints(
        _ctx: Context<CheckMintExtensionConstraints>,
    ) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
/// Context for initializing the fee configuration.
pub struct InitializeFeeConfig<'info> {
    /// Account storing the fee distribution configuration.
    #[account(
        init,
        payer = admin,
        space = 8 + 8 * 7 + 32, // Discriminator + 7 u64 fields + admin pubkey
        seeds = [b"fee-config"],
        bump,
    )]
    pub fee_config: Account<'info, FeeConfig>,
    /// Admin account initializing the configuration.
    #[account(mut)]
    pub admin: Signer<'info>,
    /// Solana's system program for creating accounts.
    pub system_program: Program<'info, System>,
}

// /// Context for initializing a token with metadata
#[derive(Accounts)]
#[instruction(
    params: InitTokenParams
)]
pub struct InitToken<'info> {
    /// CHECK: New Metaplex Account being created
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    /// Token mint account initialized with specific parameters.
    #[account(
        init,
        seeds = [b"mint"],
        bump,
        payer = payer,
        mint::decimals = params.decimals,
        mint::authority = payer,
        mint::freeze_authority = payer,
    )]
    pub mint: Account<'info, Mint>,
    /// The payer account covering the costs of creating the token.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// System rent account for Solana's rent management.
    pub rent: Sysvar<'info, Rent>,
    /// Solana's system program for creating accounts.
    pub system_program: Program<'info, System>,
    /// Token program for SPL token operations.
    pub token_program: Program<'info, Token>,
    /// Token metadata program for managing metadata.
    pub token_metadata_program: Program<'info, Metaplex>,
}

#[derive(Accounts)]
/// Context for minting tokens.
pub struct MintTokens<'info> {
    /// Token mint account for issuing tokens.
    #[account(
        mut,
        seeds = [b"mint"],
        bump,
    )]
    pub mint: Account<'info, Mint>,
    /// The destination account receiving the minted tokens.
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub destination: Account<'info, TokenAccount>,
    /// Payer account covering the transaction costs.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// System rent account for Solana's rent management.
    pub rent: Sysvar<'info, Rent>,
    /// Solana's system program for creating accounts.
    pub system_program: Program<'info, System>,
    /// Token program for SPL token operations.
    pub token_program: Program<'info, Token>,
    /// Program for creating associated token accounts.
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
/// Context for burning tokens in emergencies.
pub struct EmergencyBurn<'info> {
    /// Admin account authorized to perform the burn operation.
    #[account(mut)]
    pub admin: Signer<'info>,
    /// Token mint account whose tokens will be burned.
    #[account(mut, seeds = [b"mint"], bump)]
    pub mint: Account<'info, Mint>,
    /// Account holding the tokens to be burned.
    #[account(mut)]
    pub burn_account: Account<'info, TokenAccount>,
    /// Token program for SPL token operations
    #[account(address = spl_token::ID)]
    pub token_program: Program<'info, Token>,
}
//Purchase Fee Config
#[account]
pub struct FeeConfig {
    pub total_fee: u64,       // e.g., 3% = 3000 (basis points)
    pub validator_share: u64, // e.g., 3333 (33.33%)
    pub admin_share: u64,     // e.g., 1667 (16.67%)
    pub partner_a_share: u64, // e.g., 1667
    pub partner_b_share: u64, // e.g., 1667
    pub partner_c_share: u64, // e.g., 1667
    pub partner_d_share: u64, // e.g., 1667
}
// Define Accounts for Purchase
#[derive(Accounts)]
/// Context for processing purchases with a fee.
pub struct PurchaseWithFee<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Price feed account from Pyth, handled manually
    pub eur_usd_price_update: UncheckedAccount<'info>,
    /// CHECK: Price feed account from Pyth, handled manually
    pub sol_usd_price_update: UncheckedAccount<'info>,
    /// Liquidity account receiving the base transaction amount.
    /// CHECK: This is the liquidity_account. Its validity is enforced by the `purchase_with_fee` CPI.
    #[account(mut)]
    pub liquidity_account: UncheckedAccount<'info>,
    /// Validator account receiving a portion of the fee.
    /// CHECK: This is the validator_account. Its validity is enforced by the `purchase_with_fee` CPI.
    #[account(mut)]
    pub validator_account: UncheckedAccount<'info>,
    /// Admin account receiving a portion of the fee.
    #[account(mut)]
    pub admin_account: Account<'info, TokenAccount>,
    /// Partner A account receiving a portion of the fee.
    #[account(mut)]
    pub partner_a_account: Account<'info, TokenAccount>,
    /// Partner B account receiving a portion of the fee.
    #[account(mut)]
    pub partner_b_account: Account<'info, TokenAccount>,
    /// Partner C account receiving a portion of the fee.
    #[account(mut)]
    pub partner_c_account: Account<'info, TokenAccount>,
    /// Partner D account receiving a portion of the fee.
    #[account(mut)]
    pub partner_d_account: Account<'info, TokenAccount>,
    /// Account storing the exchange rate for EUR to SOL.
    #[account(mut, seeds = [b"exchange_rate", payer.key().as_ref()], bump = exchange_rate.bump)]
    pub exchange_rate: Account<'info, ExchangeRate>,
    pub anrx_exchange_program: Program<'info, AnrxExchangeRate>,

    /// Fee configuration account determining the fee distribution.
    #[account(mut)]
    pub fee_config: Account<'info, FeeConfig>,
    /// Solana's system program for account operations.
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

impl<'info> PurchaseWithFee<'info> {
    pub fn update_exchange_ctx(&self) -> CpiContext<'_, '_, '_, 'info, UpdateExchangeRate<'info>> {
        let cpi_program = self.anrx_exchange_program.to_account_info();
        let cpi_accounts = UpdateExchangeRate {
            exchange_rate: self.exchange_rate.to_account_info(),
            user: self.payer.to_account_info(),
            eur_usd_price_update: self.eur_usd_price_update.to_account_info(), //
            sol_usd_price_update: self.sol_usd_price_update.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

//Define the p2p Transfer accounts
#[derive(Accounts)]
pub struct P2PTransfer<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    /// CHECK: Price feed account from Pyth, handled manually
    pub eur_usd_price_update: UncheckedAccount<'info>,
    /// CHECK: Price feed account from Pyth, handled manually
    pub sol_usd_price_update: UncheckedAccount<'info>,
    #[account(mut, seeds = [b"exchange_rate", sender.key().as_ref()], bump = exchange_rate.bump)]
    pub exchange_rate: Account<'info, ExchangeRate>,
    pub anrx_exchange_program: Program<'info, AnrxExchangeRate>,

    #[account(mut)]
    pub sender_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl<'info> P2PTransfer<'info> {
    pub fn update_exchange_ctx(&self) -> CpiContext<'_, '_, '_, 'info, UpdateExchangeRate<'info>> {
        let cpi_program = self.anrx_exchange_program.to_account_info();
        let cpi_accounts = UpdateExchangeRate {
            exchange_rate: self.exchange_rate.to_account_info(),
            user: self.sender.to_account_info(),
            eur_usd_price_update: self.eur_usd_price_update.to_account_info(), //
            sol_usd_price_update: self.sol_usd_price_update.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
#[instruction(
    params: NewMetadata
)]
/// Context for updating the metadata of a token
pub struct UpdateMetadata<'info> {
    ///CHECK Metadata account to be updated.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>, // Use AccountInfo for flexibility with legacy accounts
    #[account(mut, seeds = [b"mint"], bump)]
    pub mint: Account<'info, Mint>,
    /// Authorized account to perform metadata updates.
    #[account(signer)]
    pub update_authority: Signer<'info>,
    /// Token metadata program for metadata management.
    pub token_metadata_program: Program<'info, Metaplex>,
}

// Define error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid Pyth Network Feed Data")]
    InvalidPythFeed,
    // #[msg("Invalid External Adapter Data")]
    // InvalidExternalAdapter,
    #[msg("Unauthorized Access")]
    UnauthorizedAccess,
    #[msg("Invalid Metadata Account")]
    InvalidMetadataAccount,
}

// 5. Define the init token params
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitTokenParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
}

// 5. Define the init token params
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct NewMetadata {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
}
// Define storage struct for  Metadata
#[account]
pub struct Metadata {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub update_authority: Pubkey, // Master wallet
}

//RevokeMintAuthority

#[derive(Accounts)]
pub struct RevokeMintAuthority<'info> {
    #[account(mut)]
    pub mint: Account<'info, Mint>, // Token mint account

    pub update_authority: Signer<'info>, // Authority that can update
    pub token_program: Program<'info, Token>, // SPL Token program
}

impl<'info> RevokeMintAuthority<'info> {
    /// Creates a CPI (Cross-Program Invocation) context for the `set_authority` instruction.
    /// This function simplifies the process of changing the mint authority for the token.
    fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            // Define the required accounts for the `set_authority` instruction.
            account_or_mint: self.mint.to_account_info().clone(),
            // The current authority that is permitted to make this change.
            current_authority: self.update_authority.to_account_info().clone(),
        };
        // Return a CPI context for the token program with the specified accounts.
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
    }
}
