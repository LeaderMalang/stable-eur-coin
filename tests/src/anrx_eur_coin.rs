use std::str::FromStr;

use anchor_client::{
    solana_sdk::{
        commitment_config::CommitmentConfig, pubkey::Pubkey, signature::read_keypair_file,
    },
    Client, Cluster,
};
use anrx_eur_coin::{
    accounts::{InitToken, MintTokens, RevokeMintAuthority, UpdateMetadata},
    instruction::{init_token, mint_tokens, revoke_mint_authority, update_metadata},
    InitTokenParams, NewMetadata,
};

#[test]
fn test_anrx_eur_coin() {
    // Set up the program ID and wallet
    let program_id = "FGgknVruBZEviuGyRbKrLWxnxmw2drtdkPtLXV7S3S3L"; // Replace with your deployed program ID
    let anchor_wallet = std::env::var("ANCHOR_WALLET").unwrap();
    let payer = read_keypair_file(&anchor_wallet).expect("Failed to read keypair");

    // Initialize the client
    let client = Client::new_with_options(Cluster::Localnet, payer.clone(), CommitmentConfig::processed());
    let program_id = Pubkey::from_str(program_id).unwrap();
    let program = client.program(program_id);

    // Test: Initialize Token
    let init_token_params = InitTokenParams {
        name: "ANRX EUR Coin".to_string(),
        symbol: "ANRX".to_string(),
        uri: "https://example.com/token-metadata.json".to_string(),
        decimals: 6,
    };
    let mint = Pubkey::new_unique(); // Replace with PDA logic if needed
    let metadata = Pubkey::new_unique();

    let tx = program
        .request()
        .accounts(InitToken {
            metadata,
            mint,
            payer: payer.pubkey(),
            rent: Pubkey::from_str("SysvarRent111111111111111111111111111111111").unwrap(),
            system_program: Pubkey::from_str("11111111111111111111111111111111").unwrap(),
            token_program: Pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").unwrap(),
            token_metadata_program: Pubkey::from_str("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").unwrap(),
        })
        .args(init_token(init_token_params))
        .send()
        .expect("Failed to initialize token");
    println!("Initialized Token: {}", tx);

    // Test: Mint Tokens
    let destination = Pubkey::new_unique();
    let tx = program
        .request()
        .accounts(MintTokens {
            mint,
            destination,
            payer: payer.pubkey(),
            rent: Pubkey::from_str("SysvarRent111111111111111111111111111111111").unwrap(),
            system_program: Pubkey::from_str("11111111111111111111111111111111").unwrap(),
            token_program: Pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").unwrap(),
            associated_token_program: Pubkey::from_str("ATokenGVz1yH4ov7Q7xv3kmv5TteK7uN1").unwrap(),
        })
        .args(mint_tokens(1_000_000)) // Mint 1 ANRX
        .send()
        .expect("Failed to mint tokens");
    println!("Minted Tokens: {}", tx);

    // Test: Revoke Mint Authority
    let tx = program
        .request()
        .accounts(RevokeMintAuthority {
            mint,
            update_authority: payer.pubkey(),
            token_program: Pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").unwrap(),
        })
        .args(revoke_mint_authority())
        .send()
        .expect("Failed to revoke mint authority");
    println!("Revoked Mint Authority: {}", tx);

    // Test: Update Metadata
    let new_metadata = NewMetadata {
        name: "Updated ANRX EUR Coin".to_string(),
        symbol: "U-ANRX".to_string(),
        uri: "https://example.com/new-metadata.json".to_string(),
        decimals: 6,
    };
    let tx = program
        .request()
        .accounts(UpdateMetadata {
            metadata,
            mint,
            update_authority: payer.pubkey(),
            token_metadata_program: Pubkey::from_str("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").unwrap(),
        })
        .args(update_metadata(payer.pubkey(), new_metadata))
        .send()
        .expect("Failed to update metadata");
    println!("Updated Metadata: {}", tx);
}
