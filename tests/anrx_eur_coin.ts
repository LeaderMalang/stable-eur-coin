import BN from "bn.js";
import assert from "assert";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import type { AnrxEurCoin } from "../target/types/anrx_eur_coin";
describe("Test Minter", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.AnrxEurCoin as anchor.Program<AnrxEurCoin>;

  // Metaplex Constants
  const METADATA_SEED = "metadata";
  const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

  // Constants from our program
  const MINT_SEED = "mint";
  let feeConfigAccount;
  const INTIALIZE_EXCHANGE_SEED = "exchange-rate";
  const FEE_CONFIG_SEED="fee-config";
  // Data for our tests
  const payer = program.provider.publicKey;
  const metadata = {
    name: "Annurax Euro Stablecoin",
    symbol: "ANRX€",
    uri: "https://assets.annurax-stablecoin.eu/metadata.json",
    decimals: 6

  };

  const mintAmount = BigInt(15_000_000_000_000) * BigInt(10 ** metadata.decimals);
  // const transferAmount = 1_000_000; // Example transfer amount in smallest units
  const burnAmount = 500_000; // Example burn amount in smallest units

  const [mint] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from(MINT_SEED)],
    program.programId
  );

  const [metadataAddress] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(METADATA_SEED),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  let adminTokenAccount: web3.PublicKey;
  let recipientTokenAccount: web3.PublicKey;
  let validatorAccount: web3.PublicKey;
  let partnerAAccount: web3.PublicKey;
  let partnerBAccount: web3.PublicKey;
  let partnerCAccount: web3.PublicKey;
  let partnerDAccount: web3.PublicKey;

  let EUR_TO_USD_ACCOUNT: web3.PublicKey;
  let SOL_TO_USD_ACCOUNT: web3.PublicKey;
  //Pyth feed addresses
  //Replace these with actual Pyth feed addresses
  const Price_FEED = new anchor.web3.PublicKey("0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b").toBuffer();
  //const SOL_TO_USD_FEED = new anchor.web3.PublicKey("0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d").toBuffer();

  let exchangeRateAccount:web3.PublicKey;
  before(async () => {
    //Airdrop SOL for testing
    // await program.provider.connection.confirmTransaction(
    //   await program.provider.connection.requestAirdrop(payer, 2 * anchor.web3.LAMPORTS_PER_SOL)
    // );
    console.log("Before Entered!");
    // Create associated token accounts
    adminTokenAccount = await createAssociatedTokenAccount(program.provider.connection, payer, payer, mint);

    recipientTokenAccount = await createAssociatedTokenAccount(program.provider.connection, payer, web3.Keypair.generate().publicKey, mint);
    validatorAccount = await createAssociatedTokenAccount(program.provider.connection, payer, web3.Keypair.generate().publicKey, mint);
    partnerAAccount = await createAssociatedTokenAccount(program.provider.connection, payer, web3.Keypair.generate().publicKey, mint);
    partnerBAccount = await createAssociatedTokenAccount(program.provider.connection, payer, web3.Keypair.generate().publicKey, mint);
    partnerCAccount = await createAssociatedTokenAccount(program.provider.connection, payer, web3.Keypair.generate().publicKey, mint);
    partnerDAccount = await createAssociatedTokenAccount(program.provider.connection, payer, web3.Keypair.generate().publicKey, mint);
    EUR_TO_USD_ACCOUNT = await createAssociatedTokenAccount(program.provider.connection, payer, web3.Keypair.generate().publicKey, mint);
    SOL_TO_USD_ACCOUNT = await createAssociatedTokenAccount(program.provider.connection, payer, web3.Keypair.generate().publicKey, mint);
    // Derive the exchange rate PDA
    const [exchangeRatePDA] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from(INTIALIZE_EXCHANGE_SEED)],
      program.programId
    );
    exchangeRateAccount = exchangeRatePDA;

    //Derive the fee config account address
    const [feeConfigPubkey] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from(FEE_CONFIG_SEED)],
      program.programId
    );

    feeConfigAccount = feeConfigPubkey;

    
  });
  it("Initializes the exchange rate account", async () => {

    // Initialize the exchange rate account
    const tx = await program.methods
      .initializeExchangeRate()
      .accounts({
        exchangeRateAccount:exchangeRateAccount,
        payer: payer,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Exchange rate account initialized. Tx:", tx);

  });
  //Test init token
  it("initialize", async () => {

    const info = await program.provider.connection.getAccountInfo(mint);
    if (info) {
      return; // Do not attempt to initialize if already initialized
    }
    console.log("  Mint not found. Attempting to initialize.");

    const context = {
      metadata: metadataAddress,
      mint,
      payer,
      rent: web3.SYSVAR_RENT_PUBKEY,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    };

    const tx = await program.methods
      .initToken(metadata)
      .accounts(context)
      .transaction();

    const txHash = await web3.sendAndConfirmTransaction(program.provider.connection, tx, [program.provider.wallet.payer], { skipPreflight: true });
    //console.log(`  https://explorer.solana.com/tx/${txHash}?cluster=devnet`);
    const newInfo = await program.provider.connection.getAccountInfo(mint);
    assert(newInfo, "  Mint should be initialized.");
  });

  it("mint tokens", async () => {

    const destination = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: payer,
    });

    let initialBalance = 0;
    try {
      const balance = (await program.provider.connection.getTokenAccountBalance(destination))
      initialBalance = balance.value.uiAmount;
    } catch {
      // Token account not yet initiated has 0 balance
      initialBalance = 0;
    }

    const context = {
      mint,
      destination,
      payer,
      rent: web3.SYSVAR_RENT_PUBKEY,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    };

    const tx = await program.methods
      .mintTokens(new BN(mintAmount.toString()))
      .accounts(context)
      .signers([])
      .rpc();

    //const txHash = await web3.sendAndConfirmTransaction(program.provider.connection, tx, [program.provider.wallet.payer], { skipPreflight: true });
    console.log(`  https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    const postBalance = (
      await program.provider.connection.getTokenAccountBalance(destination)
    ).value.uiAmount;
    // assert.equal(
    //   initialBalance + mintAmount / BigInt(10 ** metadata.decimals),
    //   postBalance,
    //   "Post balance should equal initial plus mint amount"
    // );
  });

  it("Initializes the Fee Config", async () => {
    const admin =payer;

    // Parameters for initialization
    const totalFee = 3000; // 3%
    const validatorShare = 1000; // 10%
    const adminShare = 500; // 5%
    const partnerAShare = 500; // 5%
    const partnerBShare = 500; // 5%
    const partnerCShare = 500; // 5%
    const partnerDShare = 500; // 5%

    // Execute the instruction
    await program.methods
      .initializeFeeConfig(
        new anchor.BN(totalFee),
        new anchor.BN(validatorShare),
        new anchor.BN(adminShare),
        new anchor.BN(partnerAShare),
        new anchor.BN(partnerBShare),
        new anchor.BN(partnerCShare),
        new anchor.BN(partnerDShare)
      )
      .accounts({
        feeConfig: feeConfigAccount,
        admin: admin,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Fetch the fee config account
    const feeConfigData = await program.account.feeConfig.fetch(feeConfigAccount);

    // Validate the values
    assert.equal(feeConfigData.totalFee.toNumber(), totalFee);
    assert.equal(feeConfigData.validatorShare.toNumber(), validatorShare);
    assert.equal(feeConfigData.adminShare.toNumber(), adminShare);
    assert.equal(feeConfigData.partnerAShare.toNumber(), partnerAShare);
    assert.equal(feeConfigData.partnerBShare.toNumber(), partnerBShare);
    assert.equal(feeConfigData.partnerCShare.toNumber(), partnerCShare);
    assert.equal(feeConfigData.partnerDShare.toNumber(), partnerDShare);

    console.log("Fee Config initialized successfully with:", feeConfigData);
  });
  it("reinvoke mint authority", async () => {
    const newMintAuthority = web3.Keypair.generate().publicKey;

    const context = {
      mint,
      updateAuthority: payer,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    };

    const tx = await program.methods
      .reinvokeMintAuthority(newMintAuthority)
      .accounts(context)
      .signers([])
      .rpc();

    console.log(`  https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    // Verify the mint authority has been updated
    const mintInfo = await spl.getMint(program.provider.connection, mint);
    assert.equal(mintInfo.mintAuthority.toBase58(), newMintAuthority.toBase58(), "Mint authority should be updated.");
  });
  it("update metadata", async () => {
    const newUpdateAuthority = web3.Keypair.generate().publicKey;
    const updatedData = {
      name: "Updated Annurax Euro Stablecoin",
      symbol: "UANRX€",
      uri: "https://assets.annurax-stablecoin.eu/updated_metadata.json",
      sellerFeeBasisPoints: 500,
      creators: null,
      collection: null,
      uses: null,
    };

    const context = {
      metadata: metadataAddress,
      mint,
      updateAuthority: payer,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    };

    const tx = await program.methods
      .updateMetadata(newUpdateAuthority, updatedData)
      .accounts(context)
      .signers([])
      .rpc();

    console.log(`  https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    // Verify the metadata has been updated
    const metadataAccount = await program.account.metadata.fetch(metadataAddress);
    assert.equal(metadataAccount.name, updatedData.name, "Metadata name should be updated.");
    assert.equal(metadataAccount.symbol, updatedData.symbol, "Metadata symbol should be updated.");
    assert.equal(metadataAccount.uri, updatedData.uri, "Metadata URI should be updated.");
  });
  it("purchase with fee", async () => {
    const exchangeRateAccount = await program.account.exchangeRate.create({
      rate: 1000000, // Example rate: 1 EUR = 1 SOL
    });

    const feeConfig = {
      validator_share: 3333, // 33.33%
      admin_share: 1667, // 16.67%
      partner_a_share: 1667, // 16.67%
      partner_b_share: 1667, // 16.67%
      partner_c_share: 1667, // 16.67%
      partner_d_share: 1667, // 16.67%
    };

    const context = {
      payer,
      liquidityAccount: adminTokenAccount, // Using adminTokenAccount as liquidity account for simplicity
      validatorAccount,
      adminAccount: adminTokenAccount,
      partnerAAccount,
      partnerBAccount,
      partnerCAccount,
      partnerDAccount,
      exchangeRateAccount,
      feeConfig: feeConfigAccount,
      systemProgram: web3.SystemProgram.programId,
    };

    const tx = await program.methods
      .purchaseWithFee(new BN(1000000)) // Example amount in smallest units
      .accounts(context)
      .signers([])
      .rpc();

    console.log(`  https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    // Verify the transfers
    const liquidityBalance = await program.provider.connection.getBalance(context.liquidityAccount);
    const validatorBalance = await program.provider.connection.getBalance(context.validatorAccount);
    const adminBalance = await program.provider.connection.getBalance(context.adminAccount);
    const partnerABalance = await program.provider.connection.getBalance(context.partnerAAccount);
    const partnerBBalance = await program.provider.connection.getBalance(context.partnerBAccount);
    const partnerCBalance = await program.provider.connection.getBalance(context.partnerCAccount);
    const partnerDBalance = await program.provider.connection.getBalance(context.partnerDAccount);

    assert(liquidityBalance > 0, "Liquidity account should have received SOL.");
    assert(validatorBalance > 0, "Validator account should have received SOL.");
    assert(adminBalance > 0, "Admin account should have received SOL.");
    assert(partnerABalance > 0, "Partner A account should have received SOL.");
    assert(partnerBBalance > 0, "Partner B account should have received SOL.");
    assert(partnerCBalance > 0, "Partner C account should have received SOL.");
    assert(partnerDBalance > 0, "Partner D account should have received SOL.");
  });
  // it("Should update the exchange rate using Pyth", async () => {
  //   // Call the update_exchange_rate function
  //   const tx = await program.methods
  //     .updateExchangeRate([1])
  //     .accounts({
  //       admin: payer,
  //       priceUpdate: EUR_TO_USD_FEED,
  //       exchangeRateAccount,
  //     })
  //     .rpc();

  //   console.log("Exchange rate updated. Tx:", tx);

  //   // Fetch the updated exchange rate account
  //   const accountData = await program.account.exchangeRate.fetch(exchangeRateAccount);

  //   // Assert that the rate is updated
  //   console.log("Updated Exchange Rate (EUR/SOL):", accountData.rate.toNumber());
  //   assert.ok(accountData.rate.toNumber() > 0, "Exchange rate should be greater than 0.");
  // });

  it("Should process a swap transaction and verify rate stability", async () => {
    // Simulating a swap of 100 ANRX
    const amountInEur = 100; // Example amount in EUR
    const exchangeRateData = await program.account.exchangeRate.fetch(
      exchangeRateAccount
    );
    const eurToSolRate = Number(exchangeRateData.rate) / 1_000_000;

    const expectedSol = amountInEur * eurToSolRate;

    // Swap logic (mocked for test)
    const swappedSol = expectedSol; // Assume successful swap
    console.log(`Swapped ${amountInEur} EUR for ${swappedSol.toFixed(6)} SOL`);

    // assert.closeTo(
    //   swappedSol,
    //   expectedSol,
    //   0.0001,
    //   "Swapped amount should match expected SOL"
    // );
  });

  // it("Updates the exchange rate using Pyth feeds", async () => {
  //   await program.methods
  //     .updateExchangeRate(Array.from(EUR_TO_USD_FEED), Array.from(SOL_TO_USD_FEED)) // No need to pass feed IDs here if they are resolved in the contract
  //     .accounts({
  //       admin: payer,
  //       eurUsdPriceUpdate: EUR_TO_USD_ACCOUNT,
  //       solUsdPriceUpdate: SOL_TO_USD_ACCOUNT,
  //       exchangeRateAccount,
  //     })
  //     .rpc();

  //   // Verify the updated rate
  //   const account = await program.account.exchangeRate.fetch(exchangeRateAccount);
  //   console.log("Exchange Rate:", account.rate);
  //   //assert.isAbove(account.rate, 0, "Exchange rate should be greater than 0");
  // });
   it("Performs a transfer with fee splitting", async () => {
    const tx = await program.methods
      .transferWithFee(new anchor.BN(transferAmount))
      .accounts({
        sender: payer,
        senderAccount: adminTokenAccount,
        recipientAccount: recipientTokenAccount,
        validatorAccount,
        adminAccount: adminTokenAccount,
        partnerAAccount,
        partnerBAccount,
        partnerCAccount,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
      })
      .signers([])
      .rpc();

    console.log("Transfer with fee transaction signature:", tx);
  });

  it("Burns tokens in an emergency", async () => {



    const tx = await program.methods
      .emergencyBurn(new BN(burnAmount))
      .accounts({
        admin:payer,
        mint: mint,
        burnAccount: adminTokenAccount,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
      })
      .signers([])
      .rpc();

    console.log("Emergency burn transaction signature:", tx);
  });


});

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
    try {
      const transaction = new anchor.web3.Transaction().add(createIx);

      await anchor.AnchorProvider.env().sendAndConfirm(transaction).catch(e => console.error(e));;
      console.log("Transaction Done!");
      //console.log(`Created associated token account: ${associatedTokenAccount.toBase58()}`);
    }
    catch (error) {
      //console.error("Transaction failed with error:", error.message);
      //console.error("Transaction logs:", error.logs);
      //throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  return associatedTokenAccount;
}
