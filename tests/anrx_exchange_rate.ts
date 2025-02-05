import assert from "assert";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";


describe("anrx_exchange_rate", () => {
    // Set up provider and program instance
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.AnrxExchangeRate;
  
    // Define necessary accounts and variables
    const payer = provider.wallet.publicKey;
    let exchangeRateAccount;
    const EUR_TO_USD_FEED = new web3.PublicKey("Fu76ChamBDjE8UuGLV6GP2AcPPSU6gjhkNhAyuoPm7ny");
    const SOL_TO_USD_FEED = new web3.PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");
  
    before(async () => {
      // Derive exchange rate PDA using the payer's public key
      [exchangeRateAccount] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("exchange_rate"), payer.toBuffer()],
        program.programId
      );

      console.log("Derived exchange rate account:", exchangeRateAccount.toBase58());
    });
  
    it("Initializes the exchange rate account", async () => {
      try {
      const tx = await program.methods
        .initializeExchangeRate()
        .accounts({
          exchangeRate: exchangeRateAccount,
          user: payer,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
  
      console.log("Exchange rate account initialized. Tx:", tx);
  
      // Fetch and verify the initialized exchange rate account
      const accountData = await program.account.exchangeRate.fetch(exchangeRateAccount);
      assert.ok(accountData.rate === 0, "Initial rate should be 0.");
      assert.strictEqual(accountData.user.toString(), payer.toString(), "User should match payer.");
      }
      catch (error) {
        console.error("Initialization error:", error);
        assert.fail("Initialization failed");
      }
    });
  
    it("Should update the exchange rate using Pyth", async () => {
      try {

      
      // Convert feed public keys to byte arrays
      const eurUsdFeedIdBytes = EUR_TO_USD_FEED.toBytes();
      const solUsdFeedIdBytes = SOL_TO_USD_FEED.toBytes();
  
      // Call the update_exchange_rate function
      const tx = await program.methods
        .updateExchangeRate(eurUsdFeedIdBytes, solUsdFeedIdBytes)
        .accounts({
          exchangeRate: exchangeRateAccount,
          user: payer,
          eurUsdPriceUpdate: EUR_TO_USD_FEED,
          solUsdPriceUpdate: SOL_TO_USD_FEED,
        })
        .rpc();
  
      console.log("Exchange rate updated. Tx:", tx);
  
      // Fetch and assert the updated exchange rate account
      const accountData = await program.account.exchangeRate.fetch(exchangeRateAccount);
  
      console.log("Updated Exchange Rate (EUR/SOL):", accountData.rate.toNumber());
      assert.ok(accountData.rate.toNumber() > 0, "Exchange rate should be greater than 0.");
      }
      catch (error) {
        console.error("Initialization error:", error);
        assert.fail("Initialization failed");
      }
    });
  });