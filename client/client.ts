import * as web3 from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import * as fs from "node:fs";
import assert from "assert";
import * as dotenv from "dotenv";
import * as metaplex from "@metaplex-foundation/mpl-token-metadata";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
dotenv.config();

// Load the .env file for configuration
const rpcUrl = process.env.RPC_URL || "https://api.devnet.solana.com";
const key = process.env.KEY.split(",").map((str) => Number.parseInt(str));
const keypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(key));
const clusterEnv = process.env.CLUSTER || "devnet"

// Setup connection and provider
const connection = new anchor.web3.Connection(rpcUrl);
const wallet = new anchor.Wallet(keypair);
const provider = new anchor.AnchorProvider(connection, wallet, {});
anchor.setProvider(provider);

let EUR_TO_USD_ACCOUNT: anchor.web3.PublicKey;
let SOL_TO_USD_ACCOUNT: anchor.web3.PublicKey;

//Pyth feed addresses

const EUR_TO_USD_FEED = new anchor.web3.PublicKey(Buffer.from("a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b", "hex")).toBase58();
const SOL_TO_USD_FEED = new anchor.web3.PublicKey(Buffer.from("0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d", "hex")).toBase58();

async function main() {
  const idlPath = "./target/idl/anrx_eur_coin.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  const programId = new anchor.web3.PublicKey(process.env.PROGRAM_ID as string);
  // const programId = new anchor.web3.PublicKey("GCyb8PFqPX6VkQNJkc5EGoNRztkvD5Y8aj2kx2nhKg6y" as string);
  const program = new anchor.Program(idl as anchor.Idl, provider); 

  // Constants
  const METADATA_SEED = "metadata";
  const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(metaplex.MPL_TOKEN_METADATA_PROGRAM_ID); // metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
  const MINT_SEED = "mint";

  const payer = provider.wallet.publicKey; // const payer = provider.publicKey;
  const metadata = {
    name: "Annurax Euro Stablecoin",
    symbol: "ANRX€", // "ANRXEU",
    uri: "https://assets.annurax-stablecoin.eu/metadata.json",
    decimals: 6,
    extensions: {
      website: "https://annurax-stablecoin.eu"
    }
  };

  const newMetadata = {
    name: "Annurax Euro Stablecoin",
    symbol: "ANRXEU",
    uri: "https://assets.annurax-stablecoin.eu/metadata.json",
    decimals: 6,
    extensions: {
      website: "https://annurax-stablecoin.eu"
    }
  };

  const mintAmount = BigInt(15_000_000_000_000) * BigInt(10 ** metadata.decimals);

  // Derive PDAs
  const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(MINT_SEED)],
    program.programId
  );

  const [metadataAddress] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(METADATA_SEED),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );


                // --------- HANDLE SAVE AND LOAD MINT KEYPAIR ---------------
                // Path to save the mint keypair
                const MINT_KEYPAIR_PATH = "./mint-authority-keypair.json";
                // Helper function to save the mint keypair
                function saveMintKeypair(keypair: Keypair) {
                  fs.writeFileSync(MINT_KEYPAIR_PATH, JSON.stringify(Array.from(keypair.secretKey)));
                  console.log(`Mint keypair saved to ${MINT_KEYPAIR_PATH}`);
                }

                // Helper function to load the mint keypair
                function loadMintKeypair(): Keypair | null {
                  if (fs.existsSync(MINT_KEYPAIR_PATH)) {
                    const secretKey = JSON.parse(fs.readFileSync(MINT_KEYPAIR_PATH, "utf8"));
                    return Keypair.fromSecretKey(Uint8Array.from(secretKey));
                  }
                  return null;
                }
                // --------- HANDLE SAVE AND LOAD MINT KEYPAIR

  // Initialize Token
  async function initToken() {
    const info = await provider.connection.getAccountInfo(mint);
    if (info) {
      console.log(`Account already exists at address: ${mint}`);
      console.log(`EUR_TO_USD_FEED: ${EUR_TO_USD_FEED}`);
      console.log(`SOL_TO_USD_FEED: ${SOL_TO_USD_FEED}`);
      return; // Do not attempt to initialize if already initialized
    }
    // const adminTokenAccount = await createAssociatedTokenAccount(provider.connection, payer, payer, mint);

    console.log("Mint not found. Attempting to initialize.");

    // console.log("----")
    // console.log(mint);
    // console.log("----")


                // Check if mint keypair exists; generate if not
                let mintKeypair = loadMintKeypair();
                if (!mintKeypair) {
                  mintKeypair = Keypair.generate();
                  saveMintKeypair(mintKeypair);
                }

    const context = {
      metadata: metadataAddress,
      mint: mint,
      payer: keypair.publicKey,  
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    };

    const txInitialize = await program.methods.initToken(metadata).accounts(context).transaction();

    try {
      // const txHash = await anchor.web3.sendAndConfirmTransaction(program.provider.connection, txInitialize, [keypair], { skipPreflight: true });
      const txHash = await anchor.web3.sendAndConfirmTransaction(program.provider.connection, txInitialize, [keypair] );
      const newInfo = await program.provider.connection.getAccountInfo(mint);
      console.log(`Mint should be initialized  ${newInfo} on cluster=devnet`);
      console.log(`Initialized Token: https://explorer.solana.com/tx/${txHash}?cluster=${clusterEnv}`);
      // console.log(context)
    } catch (error) {
      // console.error("Transaction logs:", error.logs);
      if (error instanceof anchor.web3.SendTransactionError) {
        // const logs = await error.getLogs(connection);
        console.error("Transaction failed with error:", error.message);
        console.error("Transaction logs:", error.logs);
      } else {
        console.error("An unexpected error occurred:", error);
      }
    }
  }

  // await initToken()
  // console.log(mint)

  // THis is work well now.
  async function revokeMintAuthority() {

    const privateKey = process.env.KEY
  ? Uint8Array.from(process.env.KEY.split(",").map((num) => Number.parseInt(num.trim())))
  : undefined;
  
  const options = {
    skipValidation: true
  }
  const _payer_ = Keypair.fromSecretKey(privateKey, options);

  console.log("--->", {})
    try {
      const context = {
        mint,
        updateAuthority: keypair.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      };
      const tx = await program.methods.revokeMintAuthority().accounts(context).signers([keypair]).rpc(); // _payer_ // wallet.payer
      console.log("Transaction successful with signature: ", tx);
    } catch (error) {
      console.error("Error revoking mint authority: ", error);
    }
  }
  
  console.log()
  // async function initializeFeesConfig() {
  //   const admin = payer;
  //     let feeConfigAccount: anchor.Address;
    

  //   // Parameters for initialization
  //   const totalFee = 3000; // 3%
  //   const validatorShare = 1000; // 10%
  //   const adminShare = 500; // 5%
  //   const partnerAShare = 500; // 5%
  //   const partnerBShare = 500; // 5%
  //   const partnerCShare = 500; // 5%
  //   const partnerDShare = 500; // 5%

  //   // Execute the instruction
  //   const tx = await program.methods
  //     .initializeFeeConfig(
  //       new anchor.BN(totalFee),
  //       new anchor.BN(validatorShare),
  //       new anchor.BN(adminShare),
  //       new anchor.BN(partnerAShare),
  //       new anchor.BN(partnerBShare),
  //       new anchor.BN(partnerCShare),
  //       new anchor.BN(partnerDShare)
  //     )
  //     .accounts({
  //       feeConfig: feeConfigAccount,
  //       admin: admin,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //     })
  //     .rpc();

  //   // Fetch the fee config account
  //   // const feeConfigData = await program.account.feeConfig.fetch(feeConfigAccount);

  //   // Validate the values
  //   // assert.equal(feeConfigData.totalFee.toNumber(), totalFee);
  //   // assert.equal(feeConfigData.validatorShare.toNumber(), validatorShare);
  //   // assert.equal(feeConfigData.adminShare.toNumber(), adminShare);
  //   // assert.equal(feeConfigData.partnerAShare.toNumber(), partnerAShare);
  //   // assert.equal(feeConfigData.partnerBShare.toNumber(), partnerBShare);
  //   // assert.equal(feeConfigData.partnerCShare.toNumber(), partnerCShare);
  //   // assert.equal(feeConfigData.partnerDShare.toNumber(), partnerDShare);

  //   console.log("Fee Config initialized successfully with:", tx);
  //   // console.log("Fee Config initialized successfully with:", feeConfigData); 
  // }
  
  console.log()
  // THis is a Draft function.
  async function revokeMintAuthorityV2() {
    try {
      // Create Transaction to Revoke Mint Authority
      // import { TOKEN_PROGRAM_ID, createSetAuthorityInstruction, AuthorityType } from "@solana/spl-token";
      
      const SSsecretKey = Uint8Array.from(JSON.parse(fs.readFileSync("/Users/joelz/Desktop/DESKTOP/DEV/Company/Annurax/ANRX-Coin/anrx-eur-coin/target/deploy/anrx_eur_coin-keypair.json", "utf-8")))
      const options = {
        skipValidation: true
      }

      const ownerKeypair = Keypair.fromSecretKey(SSsecretKey, {...options});

      const transaction = new Transaction().add(
        spl.createSetAuthorityInstruction(
          mint,
          mint, // wallet.payer.publicKey,  // mintAddress,
          // ownerKeypair.publicKey, // Current Authority (Owner)
          spl.AuthorityType.MintTokens,
          null,              // New Authority (null = revoke)
          [],
          spl.TOKEN_PROGRAM_ID
        )
      );
  
      // Send Transaction
      const signature = await connection.sendTransaction(transaction, [ownerKeypair]);
      console.log("Transaction Signature:", signature);
  
      // Confirm Transaction
      // await connection.confirmTransaction(signature, "confirmed");
      console.log("Mint authority revoked successfully.");
    } catch (error) {
      console.error("Error revoking mint authority:", error);
    }
  }

  // console.log("Program initialized successfully:", metadataAddress);
  // console.log("Program initialized successfully:", program.programId.toString());
 
  // --------------------------------------------------------------------------
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
//   
  // Mint Tokens
  async function mintTokens() {
    const destination = anchor.utils.token.associatedAddress({
      mint: payer,
      owner: payer,
    });

    const context = {
      mint,
      destination,
      payer,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    };

    const txMint = await program.methods
      .mintTokens(new anchor.BN(mintAmount.toString()))
      .accounts(context)
      .rpc();

    console.log(
      `Minted Tokens: https://explorer.solana.com/tx/${txMint}?cluster=${clusterEnv}`
    );
  }

  // // Purchase With Fee
  // async function purchaseWithFee(amount, liquidityAccount, feeAccounts) {
  //   const context = {
  //     liquidityAccount,
  //     feeConfig: feeAccounts,
  //     payer,
  //     systemProgram: anchor.web3.SystemProgram.programId,
  //   };

  //   const txPurchase = await program.methods
  //     .purchaseWithFee(new anchor.BN(amount))
  //     .accounts(context)
  //     .rpc();

  //   console.log(
  //     `Purchase with Fee: https://explorer.solana.com/tx/${txPurchase}?cluster=${clusterEnv}`
  //   );
  // }

  // // P2P Transfer
  // async function p2pTransfer(amount, senderAccount, recipientAccount) {
  //   const context = {
  //     senderAccount,
  //     recipientAccount,
  //     payer,
  //     tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
  //   };

  //   const txTransfer = await program.methods
  //     .p2pTransfer(new anchor.BN(amount))
  //     .accounts(context)
  //     .rpc();

  //   console.log(
  //     `P2P Transfer: https://explorer.solana.com/tx/${txTransfer}?cluster=${clusterEnv}`
  //   );
  // }

  // // Initialize Chainlink Config
  // async function initializeChainlinkConfig(eurToUsdFeed, usdToSolFeed) {
  //   const context = {
  //     payer,
  //     chainlinkConfig: eurToUsdFeed,
  //     usdToSolFeed,
  //     systemProgram: anchor.web3.SystemProgram.programId,
  //   };

  //   const txInitChainlink = await program.methods
  //     .initializeChainlinkConfig()
  //     .accounts(context)
  //     .rpc();

  //   console.log(
  //     `Initialized Chainlink Config: https://explorer.solana.com/tx/${txInitChainlink}?cluster=${clusterEnv}`
  //   );
  // }

  // // Update Chainlink Config
  // async function updateChainlinkConfig(newEurToUsdFeed, newUsdToSolFeed) {
  //   const context = {
  //     payer,
  //     chainlinkConfig: newEurToUsdFeed,
  //     usdToSolFeed: newUsdToSolFeed,
  //   };

  //   const txUpdateChainlink = await program.methods
  //     .updateChainlinkConfig()
  //     .accounts(context)
  //     .rpc();

  //   console.log(
  //     `Updated Chainlink Config: https://explorer.solana.com/tx/${txUpdateChainlink}?cluster=${clusterEnv}`
  //   );
  // }

  // // Initialize Exchange Rate // WARNING: DO NOT CALL THIS FUNCTION AGAIN.
  // async function initializeExchangeRate() {
  //   const context = {
  //     exchangeRateAccount: provider.publicKey,
  //     payer,
  //     systemProgram: anchor.web3.SystemProgram.programId,
  //   };

  //   const txInitExchange = await program.methods
  //     .initializeExchangeRate()
  //     .accounts(context)
  //     .rpc();

  //   console.log(
  //     `Initialized Exchange Rate: https://explorer.solana.com/tx/${txInitExchange}?cluster=${clusterEnv}`
  //   );
  // }

  // // Update Exchange Rate
  // async function updateExchangeRate() {
  //   const context = {
  //     exchangeRateAccount: provider.publicKey,
  //     chainlinkFeed: provider.publicKey,
  //   };

  //   const txUpdateExchange = await program.methods
  //     .updateExchangeRate()
  //     .accounts(context)
  //     .rpc();

  //   console.log(
  //     `Updated Exchange Rate: https://explorer.solana.com/tx/${txUpdateExchange}?cluster=${clusterEnv}`
  //   );
  // }

  // Update Metadata
  // async function updateMetadata(newMetadata) {
  //   const destination = await anchor.utils.token.associatedAddress({
  //     mint: mint,
  //     owner:payer
  //   });

  //   const context = {
  //     metadata: metadataAddress,
  //     mint,
  //     update_authority: payer,
  //     tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //     rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //     systemProgram: anchor.web3.SystemProgram.programId,
  //   };
  //   const newUri = "https://raw.githubusercontent.com/LeaderMalang/metadata_anrx/main/metadata.json";

  //   try {
  //     const txUpdateMetadata = await program.methods
  //       .updateMetadata(newUri)
  //       .accounts(context)
  //       .rpc();
  //     console.log(`Metadata updated successfully: ${txUpdateMetadata}`);
  //   } catch (error) {
  //     console.error("Failed to update metadata:", error);
  //   }
  // }

  async function updateMetadataV2(){
        const newUpdateAuthority = web3.Keypair.generate().publicKey;
        const updatedData = {
          name: "Annurax TEST",
          symbol: "UANRX",
          uri: "https://assets.annurax-stablecoin.eu/metadata.json",
          sellerFeeBasisPoints: 500,
          creators: null,
          collection: null,
          uses: null,
        };
    
        const context = {
          metadata: metadataAddress,
          mint,
          updateAuthority: keypair.publicKey,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        };
    
        try {
          const tx = await program.methods
          .updateMetadata(newUpdateAuthority, updatedData)
          .accounts(context)
          .signers([])
          .rpc();
    
        console.log(`  https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    
        // Verify the metadata has been updated
        // const metadataAccount = await program.account.metadata.fetch(metadataAddress);
        // assert.equal(metadataAccount.name, updatedData.name, "Metadata name should be updated.");
        // assert.equal(metadataAccount.symbol, updatedData.symbol, "Metadata symbol should be updated.");
        // assert.equal(metadataAccount.uri, updatedData.uri, "Metadata URI should be updated.");
        } catch(e){
          console.log("Error updating: ", e)
        }
  }
  
  await updateMetadataV2()

  // // Update Transfer Fee
  // async function updateTransferFee(newFee) {
  //   const context = {
  //     payer,
  //     feeConfig: provider.publicKey,
  //   };

  //   const txUpdateFee = await program.methods
  //     .updateTransferFee(newFee)
  //     .accounts(context)
  //     .rpc();

  //   console.log(
  //     `Updated Transfer Fee: https://explorer.solana.com/tx/${txUpdateFee}?cluster=${clusterEnv}`
  //   );
  // }

  // // const newMetadata =  { ...metadata }

  // async function Testing(){
  //   const context = {
  //     payer,
  //     feeConfig: provider.publicKey,
  //   };

  //   const context3 = {
  //     metadata: metadataAddress,
  //     payer,
  //   };

  //   // const accountInfo = await connection.getAccountInfo(mint);
  //   // const TOKEN_METADATA_PROGRAM_ID= new anchor.web3.PublicKey("...");
  //   // console.log(`DATA : ${anchor.utils.token.TOKEN_PROGRAM_ID}`)
  //   // console.log(`DATA : ${JSON.stringify({accountInfo: anchor.utils.token.TOKEN_PROGRAM_ID})}`)
  // }

  // Execute the desired methods
  // await initToken()
  // await mintTokens()
  // await revokeMintAuthority()
  // await updateMetadata(newMetadata)
  // await updateTransferFee(3000)
  // await Testing()
}

console.log("Running client.");
main().then(() => console.log("Success"));


// Helper function to create an associated token account
async function createAssociatedTokenAccount(
  connection: anchor.web3.Connection,
  payer: web3.PublicKey,
  owner: web3.PublicKey,
  mint: web3.PublicKey
): Promise<web3.PublicKey> {
  const associatedTokenAccount = await spl.getAssociatedTokenAddress(mint, owner);
  
  try {
    await spl.getAccount(connection, associatedTokenAccount);
    console.log(`Associated token account already exists: ${associatedTokenAccount.toBase58()}`);
  } catch {

    const createIx = spl.createAssociatedTokenAccountInstruction(
      payer,
      associatedTokenAccount,
      owner,
      mint
    );

    // 
    try {
      const transaction = new anchor.web3.Transaction().add(createIx);

      await anchor.AnchorProvider.env().sendAndConfirm(transaction).catch(e => console.error(e));;
      console.log("Transaction Done!");
      console.log(`Created associated token account: ${associatedTokenAccount.toBase58()}`);
    }
    catch (error) {
      console.error("Transaction failed with error:", 
        {
        error: {
          message: error.message,
          logs: error.logs
        } 
      });
    }
    // 
  }

  return associatedTokenAccount;
}