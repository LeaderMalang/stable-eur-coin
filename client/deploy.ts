import assert from "assert";
import * as fs from "node:fs";
import * as anchor from "@coral-xyz/anchor";
import * as metaplex from "@metaplex-foundation/mpl-token-metadata";
import { HermesClient } from "@pythnetwork/hermes-client";
import * as devLib from "@solana-developers/helpers";
import * as spl from "@solana/spl-token";
import {
	TOKEN_2022_PROGRAM_ID,
	createInitializeAccount3Instruction,
	createInitializeMintCloseAuthorityInstruction,
	createInitializeMintInstruction,
	createInitializeTransferFeeConfigInstruction,
	createSetAuthorityInstruction,
	getAccountLen,
	getMintLen,
} from "@solana/spl-token";

// import {
// 	TokenMetadata,
// 	createInitializeInstruction,
// 	createRemoveKeyInstruction,
// 	createUpdateFieldInstruction,
// 	pack,
// } from "@solana/spl-token-metadata";

import * as splM from "@solana/spl-token-metadata";
import * as web3 from "@solana/web3.js";
import { type Connection, type Keypair, type PublicKey, Transaction, clusterApiUrl } from "@solana/web3.js";
import * as dotenv from "dotenv";
import {
	type CurrentNetwork,
	ExplorerName,
	checkIfMainnet,
	checkOrGenerateSaveAndLoadKeypair,
	generateKeypair,
	loadKeypair,
	promptToProceed,
	saveKeypair,
	showTransactionOnExplorer,
} from "./helpers/lib"; // "@clientHelpers"
dotenv.config();

// Load the .env file for configuration and keypairs
const ANRX_PROGRAM_ID = process.env.PROGRAM_ID || "";
const MAIN_KEY = process.env.KEY || "";
const rpcUrl = process.env.RPC_URL || "https://api.devnet.solana.com";
const clusterEnv: CurrentNetwork = process.env.CLUSTER as CurrentNetwork;
const CONFIRMATION_COMMITMENT = "confirmed";

if (!ANRX_PROGRAM_ID) throw new Error("Error: You must define a Program ID on .env file!").message;
if (!MAIN_KEY) throw new Error("Error: You must define a KEY on .env file!").message;
if (!rpcUrl) throw new Error("Error: You must define the RPC URL on .env file!").message;
if (!clusterEnv) throw new Error("Error: You must define the ClusterEnvironment on .env file!").message;

// Define dynamic constants
const n: "m" | "d" = clusterEnv === "devnet" ? "d" : "m";
const BASE_PATH_DEV_KEYPAIRS = `./.devKeypairs/${clusterEnv}`;

// Setup connection and provider
const connection = new anchor.web3.Connection(rpcUrl); // TODO: CONFIRMATION_COMMITMENT ? // OR THIS: const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
const explorerData = { explorerName: ExplorerName.Solscan, network: n };
const key = MAIN_KEY.split(",").map((str) => Number.parseInt(str));
const keypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(key));
const wallet = new anchor.Wallet(keypair);
const provider = new anchor.AnchorProvider(connection, wallet, {}); // TODO: {CONFIRMATION_COMMITMENT} ?
anchor.setProvider(provider);

const idlPath = "./target/idl/anrx_eur_coin.json";
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
const programId = new anchor.web3.PublicKey(ANRX_PROGRAM_ID as string);
const program = new anchor.Program(idl as anchor.Idl, provider);
const payer = provider.wallet.publicKey; // const payer = provider.publicKey;

// Define nesseccary Keypairs path to generate or Load
const EUR_TO_SOL_KEYPAIRS_PATH = `${BASE_PATH_DEV_KEYPAIRS}/EURO-TO-SOL-authority-keypair.json`;
const MINT_KEYPAIR_PATH_FILE: string = `${BASE_PATH_DEV_KEYPAIRS}/_1_DEMO_16_240125_mint_test-keypairs.json`;
const TOKEN_ACCOUNT_KEYPAIR_PATH_FILE: string = `${BASE_PATH_DEV_KEYPAIRS}/_4_DEMO_TOKEN_ACCOUNT-keypairs.json`;

let mintAcckeypair: Keypair | null = loadKeypair(MINT_KEYPAIR_PATH_FILE);
let tokenAccountKeypair: Keypair | null = loadKeypair(TOKEN_ACCOUNT_KEYPAIR_PATH_FILE);

// OLD
// // Constants
// const METADATA_SEED = "metadata";
// const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(metaplex.MPL_TOKEN_METADATA_PROGRAM_ID);
// const MINT_SEED = "mint";

const metadata = {
	name: "DEMO TOKEN", // "Annurax Euro Stablecoin",
	symbol: "DMTKN", // "ANRX€", // "ANRXEU",
	uri: "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/DeveloperPortal/metadata.json", // "https://assets.annurax-stablecoin.eu/metadata.json",
	decimals: 6,
	extensions: {
		website: "https://annurax-stablecoin.eu",
	},
};

const mintAmount = BigInt(15_000_000_000_000) * BigInt(10 ** metadata.decimals);

// OLD
// // Derive PDAs
// const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
// 	[Buffer.from(MINT_SEED), keypair.publicKey.toBuffer()],
// 	program.programId,
// );

// OLD
// const [metadataAddress] = anchor.web3.PublicKey.findProgramAddressSync(
// 	[Buffer.from(METADATA_SEED), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
// 	TOKEN_METADATA_PROGRAM_ID,
// );

// ****************************************** [ A - Initialize Token ]
// OLD TEST
// async function initToken() {
// 	const info = await provider.connection.getAccountInfo(mint);
// 	if (info) {
// 		console.log(`Account already exists at address: ${mint}`);
// 		return;
// 	}

// 	// const adminTokenAccount = await createAssociatedTokenAccount(provider.connection, payer, payer, mint);
// 	console.log("Mint not found. Attempting to initialize.");

// 	// // Check if mint keypair exists; generate if not
// 	// let mintKeypair = loadKeypair(MINT_KEYPAIR_PATH_FILE);
// 	// if (!mintKeypair) {
// 	// 	mintKeypair = generateKeypair();
// 	// 	saveKeypair(mintKeypair, MINT_KEYPAIR_PATH_FILE);
// 	// }

// 	const context = {
// 		metadata: metadataAddress,
// 		mint: mint,
// 		payer: keypair.publicKey,
// 		rent: anchor.web3.SYSVAR_RENT_PUBKEY,
// 		systemProgram: anchor.web3.SystemProgram.programId,
// 		tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
// 		tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
// 	};

// 	const txInitialize = await program.methods.initToken(metadata).accounts(context).transaction();

// 	try {
// 		const txHash = await anchor.web3.sendAndConfirmTransaction(
// 			program.provider.connection,
// 			txInitialize,
// 			[keypair],
// 			// { skipPreflight: true }
// 		);

// 		const newInfo = await program.provider.connection.getAccountInfo(mint);
// 		console.log(`Mint should be initialized ${newInfo} on cluster=${clusterEnv}`);
// 		console.log(`Initialized Token: https://explorer.solana.com/tx/${txHash}?cluster=${clusterEnv}`);
// 	} catch (error) {
// 		if (error instanceof anchor.web3.SendTransactionError) {
// 			// const logs = await error.getLogs(connection);
// 			console.error("Transaction failed with error:", error.message);
// 			console.error("Transaction logs:", error.logs);
// 		} else {
// 			console.error("An unexpected error occurred:", error);
// 		}
// 	}
// }

// // NOT TESTED & OLD TEST
// async function initMintAccount() {
// 	// try {
// 	// 	console.log("Initializing new mint Account...");
// 	// 	const context = {
// 	// 		mint,
// 	// 		updateAuthority: keypair.publicKey,
// 	// 		tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
// 	// 	};
// 	// 	const tx = await program.methods.revokeMintAuthority().accounts(context).signers([keypair]).rpc();
// 	// 	console.log("Transaction successful with signature: ", tx);
// 	// } catch (error) {
// 	// 	console.error("Error revoking mint authority: ", error);
// 	// }
// }

async function initMintAndToken2022AccountAndMintTokensToAssociatedTokenAccount() {
	if (!mintAcckeypair) {
		mintAcckeypair = checkOrGenerateSaveAndLoadKeypair(mintAcckeypair, MINT_KEYPAIR_PATH_FILE);
	}

	if (!tokenAccountKeypair) {
		tokenAccountKeypair = checkOrGenerateSaveAndLoadKeypair(null, TOKEN_ACCOUNT_KEYPAIR_PATH_FILE);
	}

	const mint = mintAcckeypair.publicKey;
	const mintAuthority = keypair.publicKey;
	const freezeAuthority = keypair.publicKey;
	const closeAuthority = keypair.publicKey;
	const updateAuthority = keypair.publicKey;
	const _tokenAccount_ = tokenAccountKeypair.publicKey;

	const extensionsToEnable = [
		spl.ExtensionType.MintCloseAuthority,
		spl.ExtensionType.MetadataPointer,
		spl.ExtensionType.TransferFeeConfig,
	];

	// Metadata to store in Mint Account
	const metaData: splM.TokenMetadata = {
		updateAuthority: updateAuthority,
		mint: mint,
		name: metadata.name,
		symbol: metadata.symbol,
		uri: metadata.uri,
		additionalMetadata: [["description", "Only Possible On Solana Signed!"]],
	};

	const metadataExtension = spl.TYPE_SIZE + spl.LENGTH_SIZE; // Size of MetadataExtension 2 bytes for type, 2 bytes for length
	const metadataLen = splM.pack(metaData).length; // Size of metadata
	const mintLen = getMintLen(extensionsToEnable);
	const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataExtension + metadataLen);
	const accountLen = getAccountLen([spl.ExtensionType.ImmutableOwner]);
	const accountLamports = await connection.getMinimumBalanceForRentExemption(spl.AccountLayout.span + accountLen);

	try {
		// Instruction to invoke System Program to create new account for Mint
		const createAccountInstruction = web3.SystemProgram.createAccount({
			fromPubkey: keypair.publicKey,
			newAccountPubkey: mint, // Address of the account to create
			lamports,
			space: mintLen,
			programId: TOKEN_2022_PROGRAM_ID,
		});

		// Instruction to invoke System Program to create new account for Token Account
		const createTokenAccountInstruction = web3.SystemProgram.createAccount({
			fromPubkey: keypair.publicKey,
			newAccountPubkey: _tokenAccount_, // Address of the account to create
			lamports: accountLamports,
			space: spl.AccountLayout.span + accountLen,
			programId: TOKEN_2022_PROGRAM_ID,
		});

		// Initialiser directement le compte token avec createInitializeAccount3Instruction
		const initializeAccount3Instruction = createInitializeAccount3Instruction(
			_tokenAccount_,
			mint,
			keypair.publicKey,
			TOKEN_2022_PROGRAM_ID,
		);

		// Instruction to initialize the ImmutableOwner Extension
		const initializeImmutableOwnerInstruction = spl.createInitializeImmutableOwnerInstruction(
			_tokenAccount_,
			TOKEN_2022_PROGRAM_ID,
		);

		// Instruction to initialize the MetadataPointer Extension
		const initializeMetadataPointerInstruction = spl.createInitializeMetadataPointerInstruction(
			mint,
			updateAuthority,
			mint, // Account address that holds the metadata
			TOKEN_2022_PROGRAM_ID,
		);

		// Instruction to initialize Mint Account data
		const initializeMintInstruction = createInitializeMintInstruction(
			mint,
			metadata.decimals,
			mintAuthority,
			freezeAuthority,
			TOKEN_2022_PROGRAM_ID,
		);

		// Instruction to initialize Metadata Account data
		const initializeMetadataInstruction = splM.createInitializeInstruction({
			programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
			metadata: mint, // Account address that holds the metadata
			updateAuthority: updateAuthority, // Authority that can update the metadata
			mint: mint, // Mint Account address
			mintAuthority: mintAuthority, // Designated Mint Authority
			name: metaData.name,
			symbol: metaData.symbol,
			uri: metaData.uri,
		});

		// Instruction to update metadata, adding custom field
		const updateFieldInstruction = splM.createUpdateFieldInstruction({
			programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
			metadata: mint, // Account address that holds the metadata
			updateAuthority: updateAuthority, // Authority that can update the metadata
			field: metaData.additionalMetadata[0][0], // key
			value: metaData.additionalMetadata[0][1], // value
		});

		// Instruction to initialize the MintCloseAuthority Extension
		const initializeMintCloseAuthorityInstruction = createInitializeMintCloseAuthorityInstruction(
			mint,
			closeAuthority,
			TOKEN_2022_PROGRAM_ID,
		);

		// Enable TransferFeeConfig
		const initializeTransferFeeInstruction = createInitializeTransferFeeConfigInstruction(
			mint,
			keypair.publicKey, // transferFeeConfigAuthority
			keypair.publicKey, // withdrawWithheldAuthority
			0, // transferFeeBasisPoints (Transfer fee in basis points, e.g., 400 for 4%, 0 for 0%)
			BigInt(30000), // maxTransferFee (Maximum transfer fee in smallest token units, e.g., 30,000 for 3% with 6 decimals)
			TOKEN_2022_PROGRAM_ID,
		);

		// Add instructions to new transaction
		const transaction = new Transaction().add(
			createAccountInstruction,
			initializeTransferFeeInstruction,
			initializeMetadataPointerInstruction,
			// note: the above instructions are required before initializing the mint
			initializeMintCloseAuthorityInstruction,
			initializeMintInstruction,
			initializeMetadataInstruction,
			updateFieldInstruction,
		);

		// Send transaction
		const tx = await web3.sendAndConfirmTransaction(connection, transaction, [keypair, mintAcckeypair]);
		console.log("\nCreate Mint Account:", showTransactionOnExplorer(tx, explorerData));

		// ----------------------------------TOKEN ACCOUNT TRANSACTION----------------------------------
		const transactionAcc = new Transaction().add(
			createTokenAccountInstruction,
			initializeImmutableOwnerInstruction,
			initializeAccount3Instruction,
		);

		const txAcc = await web3.sendAndConfirmTransaction(connection, transactionAcc, [keypair, tokenAccountKeypair]);
		console.log("Associated Token Account:", tokenAccountKeypair.publicKey.toBase58());
		console.log("\nToken account created and initialized:", showTransactionOnExplorer(txAcc, explorerData));

		// // --- NOT IN USE --- Create an associated token account for the payer
		// console.log("Creating associated token account for the payer...");
		// const allowOwnerOffCurve = false;
		// const tokenAccount = await spl.getOrCreateAssociatedTokenAccount(
		// 	connection, // Connection
		// 	keypair, // Payer keypair.publicKey
		// 	mint, // Mint address
		// 	keypair.publicKey, // Owner of the token account
		// 	allowOwnerOffCurve, // Allow owner off curve
		// 	"confirmed",
		// 	undefined,
		// 	TOKEN_2022_PROGRAM_ID, // Token program ID
		// );

		// const mintToInstruction = spl.createMintToInstruction(
		// 	mint, // Mint address
		// 	_tokenAccount_, //tokenAccount.address, // Destination token account
		// 	mintAuthority, // Mint authority
		// 	mintAmount, // Amount to mint
		// 	[], // Signers (none needed for TOKEN_2022_PROGRAM_ID)
		// 	TOKEN_2022_PROGRAM_ID, // Token program ID
		// )
		// // --- NOT IN USE ---

		// Mint tokens to the associated token account

		const mintToInstruction = spl.createMintToCheckedInstruction(
			mint,
			_tokenAccount_, // The target token account
			mintAuthority, // The mint authority
			mintAmount, // Amount of tokens to mint
			metadata.decimals, // Number of decimals
			[],
			TOKEN_2022_PROGRAM_ID,
		);

		const mintTransaction = new Transaction().add(mintToInstruction);

		// Sign and send the mint transaction
		console.log(`\nMinting ${mintAmount} tokens to the payer's associated token account...`);
		const mintTxHash = await web3.sendAndConfirmTransaction(connection, mintTransaction, [keypair]);
		console.log("\nMinting complete!", showTransactionOnExplorer(mintTxHash, explorerData));
	} catch (err) {
		console.error("Failed to fetch token account:", err);
		return false;
	}
}

async function revokeMintAuthorityTokenProgram2022() {
	if (!mintAcckeypair) {
		mintAcckeypair = checkOrGenerateSaveAndLoadKeypair(mintAcckeypair, MINT_KEYPAIR_PATH_FILE);
	}

	const initRevokeMintAuthority = createSetAuthorityInstruction(
		mintAcckeypair.publicKey, // Mint account
		keypair.publicKey, // Current authority
		spl.AuthorityType.MintTokens, // Authority type (Mint Tokens)
		null, // New authority (null to revoke)
		[keypair, mintAcckeypair],
		TOKEN_2022_PROGRAM_ID,
	);

	const transaction = new Transaction().add(initRevokeMintAuthority);
	const tx = await web3.sendAndConfirmTransaction(connection, transaction, [keypair, mintAcckeypair]); // , { skipPreflight: false }
	console.log("\nMint Authority Revoked, Transaction Signature:", showTransactionOnExplorer(tx, explorerData));
}

// async function setTransferFeeTokenProgram2022(connection, payer, mint, mintAuthority, feeBasisPoints) {
// 	// // Get the current mint account info
// 	// const mintAccountInfo = await spl.getMint(connection, mint, TOKEN_2022_PROGRAM_ID);
// 	// if (!mintAccountInfo.mintAuthority) {
// 	//   throw new Error("Mint authority is not set for this mint.");
// 	// }
// 	// if (!mintAccountInfo.extensionTypes.includes("transferFeeConfig")) {
// 	//   throw new Error("Mint does not support transfer fees. Please enable the TransferFeeConfig extension.");
// 	// }
// 	// // Calculate the max transfer fee in tokens (optional adjustment)
// 	// const maxTransferFee = feeBasisPoints * 10 ** mintAccountInfo.decimals;
// 	// // Create instruction to set transfer fees
// 	// const setTransferFeeInstruction = spl.createSetTransferFeeInstruction(
// 	//   mint,                      // Mint account public key
// 	//   mintAuthority.publicKey,   // Mint authority public key
// 	//   TOKEN_2022_PROGRAM_ID,     // Token-2022 Program ID
// 	//   feeBasisPoints,            // Transfer fee in basis points
// 	//   maxTransferFee             // Maximum fee in smallest denomination (optional)
// 	// );
// 	// // Create a transaction
// 	// const transaction = new Transaction().add(setTransferFeeInstruction);
// 	// // Sign and send the transaction
// 	// const signature = await connection.sendTransaction(transaction, [payer, mintAuthority]);
// 	// console.log(`Transfer fee set successfully. Transaction signature: ${signature}`);
// }

// OK

async function closeMintToken2022Account() {
	// const tokenMintAccountKeypairs = loadKeypair("./anrxeLk4NCgFy4vgHq9kT9t4A4c3U67a2PJCsAUirpd.json");

	const keyPairPath = "./240125_mint_test-keypairs.json"; // "./240125_mint-2_test-keypairs.json"; //
	const mintAcckeypair = loadKeypair(keyPairPath); // generateKeypair(); //
	// saveKeypair(mintAcckeypair, keyPairPath);

	const mint = mintAcckeypair.publicKey;

	try {
		// Send transaction to close Mint Account
		const closeAuthority = keypair.publicKey;
		const tx = await spl.closeAccount(
			connection,
			keypair,
			mint,
			keypair.publicKey,
			closeAuthority,
			undefined,
			undefined,
			TOKEN_2022_PROGRAM_ID,
		);

		console.log("\nClose Mint Account:", `https://solana.fm/tx/${tx}?cluster=devnet-solana`);
	} catch (e) {
		console.error("\nError closing account:", e);
	}
}

// ############################################## INIT; MANAGE TRANSACTIONS ########################################
// async function freezeTokenAccount(
// 	connection: Connection,
// 	freezeAuthority: Keypair, // The keypair of the freeze authority
// 	tokenAccount: PublicKey, // The token account to freeze
// 	mint: PublicKey, // The mint address of the token
// ) {
// 	// Create the transaction
// 	const transaction = new Transaction().add(
// 		// spl.createFreezeAccountInstruction(TOKEN_2022_PROGRAM_ID, tokenAccount, mint, freezeAuthority),
// 		// spl.createFreezeAccountInstruction(TOKEN_2022_PROGRAM_ID, tokenAccount, mint, keypair.publicKey),
// 	);

// 	// Send the transaction
// 	const txHash = await connection.sendTransaction(transaction, [freezeAuthority]);
// 	console.log(`Token account frozen. Transaction hash: ${txHash}`);
// }

// async function thawTokenAccount(
// 	connection: Connection,
// 	freezeAuthority: Keypair, // The keypair of the freeze authority
// 	tokenAccount: PublicKey, // The token account to thaw
// 	mint: PublicKey, // The mint address of the token
// ) {
// 	// Create the transaction
// 	const transaction = new Transaction().add(
// 		Token.createThawAccountInstruction(TOKEN_2022_PROGRAM_ID, tokenAccount, mint, freezeAuthority.publicKey),
// 	);

// 	// Send the transaction
// 	const txHash = await connection.sendTransaction(transaction, [freezeAuthority]);
// 	console.log(`Token account thawed. Transaction hash: ${txHash}`);
// }

// async function revokeCloseMintAuthority(
// 	connection: Connection,
// 	payer: Keypair, // Payer for transaction fees
// 	mint: PublicKey, // Mint address of the token
// 	currentCloseAuthority: Keypair, // Current Close Mint Authority
// ) {
// 	// Create the revoke instruction
// 	const revokeInstruction = spl.createRevokeInstruction(
// 		mint, // Mint address
// 		currentCloseAuthority.publicKey, // Current Close Mint Authority
// 		null, // Setting the Close Mint Authority to null
// 		[], // Signers (no multisig support needed in this case)
// 		TOKEN_2022_PROGRAM_ID, // Token2022 Program ID
// 	);

// 	// Create the transaction
// 	const transaction = new Transaction().add(revokeInstruction);

// 	// Send and confirm the transaction
// 	const txHash = await connection.sendTransaction(transaction, [payer, currentCloseAuthority]);
// 	console.log(`Close Mint Authority revoked. Transaction hash: ${txHash}`);
// }

// async function transferTokens(
// 	connection: Connection,
// 	sender: PublicKey,
// 	recipient: PublicKey,
// 	mint: PublicKey,
// 	senderAuthority: Keypair,
// 	amount: number,
// 	decimals: number,
// ) {
// 	const transaction = new Transaction().add(
// 		spl.createTransferCheckedInstruction(
// 			sender, // Sender's token account
// 			mint, // Token mint address
// 			recipient, // Recipient's token account
// 			senderAuthority.publicKey, // Authority to sign the transfer
// 			amount, // Amount of tokens to transfer
// 			decimals, // Decimals of the token
// 			[], // Additional signers (if required)
// 			TOKEN_2022_PROGRAM_ID, // Use the Token 2022 Program ID
// 		),
// 	);

// 	const txHash = await connection.sendTransaction(transaction, [senderAuthority]);
// 	console.log(`Tokens transferred. Transaction hash: ${txHash}`);
// }

// async function setTokenMetadata(connection: Connection, mint: PublicKey, metadataURI: string, metadataAuthority: Keypair) {
// 	const transaction = new Transaction().add(
// 		createSetTokenMetadataInstruction(
// 			mint, // Token mint address
// 			metadataAuthority.publicKey, // Authority to set the metadata
// 			metadataURI, // URI pointing to the metadata JSON
// 			[], // Additional signers (if required)
// 			TOKEN_2022_PROGRAM_ID, // Use the Token 2022 Program ID
// 		),
// 	);

// 	const txHash = await connection.sendTransaction(transaction, [metadataAuthority]);
// 	console.log(`Token metadata updated. Transaction hash: ${txHash}`);
// }
// ############################################## END; MANAGE TRANSACTIONS ########################################

async function checkIfTokenAccountInitialized(tokenAccountPubkey: web3.PublicKey) {
	try {
		// Fetch token account info
		const accountInfo = await spl.getAccount(connection, tokenAccountPubkey);

		console.log("accountInfo", accountInfo);
		// Check if account is initialized
		if (accountInfo.isInitialized) {
			console.log("Token account is initialized:", accountInfo);
			return true;
		}
		console.log("Token account is not initialized");
		return false;
	} catch (err) {
		console.error("Failed to fetch token account:", err);
		return false;
	}
}

// ****************************************** [ B - Mint Tokens ]
// async function mintTokens() {
// 	const destination = anchor.utils.token.associatedAddress({
// 		mint,
// 		owner: payer,
// 	});

// 	const context = {
// 		mint,
// 		destination,
// 		payer,
// 		rent: anchor.web3.SYSVAR_RENT_PUBKEY,
// 		systemProgram: anchor.web3.SystemProgram.programId,
// 		tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
// 		associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
// 	};

// 	const txMint = await program.methods.mintTokens(new anchor.BN(mintAmount.toString())).accounts(context).rpc();

// 	console.log(`Minted Tokens: https://explorer.solana.com/tx/${txMint}?cluster=${clusterEnv}`);
// }

async function mintTokensWithToken2022Account() {
	if (!mintAcckeypair) {
		mintAcckeypair = checkOrGenerateSaveAndLoadKeypair(mintAcckeypair, MINT_KEYPAIR_PATH_FILE);
	}

	const mint_ = mintAcckeypair.publicKey;

	const destination = anchor.utils.token.associatedAddress({
		mint: mint_,
		owner: payer,
	});

	// console.log(`Minted Tokens: https://explorer.solana.com/tx/${txMint}?cluster=${clusterEnv}`);
}

// ****************************************** [ C - Revoke Mint Authority  ]
// async function revokeMintAuthority() {
// 	try {
// 		console.log("Revoking the mint Authority...");
// 		const context = {
// 			mint,
// 			updateAuthority: keypair.publicKey,
// 			tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
// 		};
// 		const tx = await program.methods.revokeMintAuthority().accounts(context).signers([keypair]).rpc();
// 		console.log("Transaction successful with signature: ", tx);
// 	} catch (error) {
// 		console.error("Error revoking mint authority: ", error);
// 	}
// }

// ****************************************** [ D - Initialize Euro/Usd and Sol/Usd Accounts  ]
async function initEurUsdNSolUsdPriceUpdateAccounts() {}

// ****************************************** [ E - Initialize Exchange Rate Account  ]
async function initExchangeRateAccount() {}

// ****************************************** [ F - Update Exchange Rate Account With PhythNetWork ]
async function updateExchangeRate() {}

// ****************************************** [ X - Close Mint PDA Account ]
// async function closeMintPDA() {
// 	// const connection = new Connection("https://api.devnet.solana.com");
// 	// const masterWallet = Keypair.fromSecretKey(
// 	// 	new Uint8Array(JSON.parse(require("fs").readFileSync("./master-wallet.json", "utf8"))),
// 	// );

// 	// const mintPda = new PublicKey("<MINT_PDA_PUBLIC_KEY>"); // Replace with your PDA mint account
// 	// const recipient = masterWallet.publicKey; // The SOL will be reclaimed here

// 	try {
// 		// Step 1: Fetch mint account info
// 		const mintAccountInfo = await connection.getAccountInfo(mint);
// 		if (!mintAccountInfo) {
// 			console.log("Mint account does not exist!");
// 			return;
// 		}
// 		// console.log("Mint account Info :", mintAccountInfo);

// 		// Step 2: Ensure the mint supply is zero (if applicable)
// 		// const mintSupply = 0; // Replace with logic to fetch supply
// 		// if (mintSupply == 0) {
// 		// 	console.log("Mint account cannot be closed because the supply is not zero.");
// 		// 	return;
// 		// }

// 		// Step 3: Close the account (requires program authority)
// 		const tx = new Transaction().add(
// 			web3.SystemProgram.transfer({
// 				fromPubkey: mint,
// 				toPubkey: keypair.publicKey, // payer, //
// 				lamports: mintAccountInfo.lamports,
// 			}),
// 		);

// 		// console.log("Mint account Info :", transaction);

// 		// Sign and send the transaction
// 		const signature = await connection.sendTransaction(tx, [keypair]);
// 		console.log("Transaction successful! Signature:", signature);
// 	} catch (error) {
// 		console.error("Error closing mint account:", error);
// 	}
// }

//
// async function closeMintPDA_() {
// 	try {
// 		// const instructionData = program.instruction.closeMint({
// 		// 	accounts: {
// 		// 		mint: mint,
// 		// 		recipient: keypair.publicKey,
// 		// 		payer: keypair.publicKey,
// 		// 		systemProgram: web3.SystemProgram.programId,
// 		// 	},
// 		// });

// 		// Create the transaction
// 		const transaction = new Transaction();

// 		// Create an instruction to close the PDA mint account
// 		const closeInstruction = new anchor.web3.TransactionInstruction({
// 			keys: [
// 				{ pubkey: mint, isSigner: false, isWritable: true }, // The PDA mint account to close
// 				{ pubkey: keypair.publicKey, isSigner: false, isWritable: true }, // The recipient of the funds
// 				{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }, // The payer
// 				{ pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false }, // System program
// 			],
// 			programId, // Program ID associated with this instruction
// 			data: Buffer.from([]), // Buffer.alloc(0), // No extra data needed
// 		});

// 		// Add the instruction to the transaction
// 		transaction.add(closeInstruction);

// 		// Send the transaction
// 		const signature = await connection.sendTransaction(transaction, [keypair]);

// 		console.log(`Transaction signature: ${signature}`);
// 		console.log(`Mint PDA ${mint.toBase58()} closed and funds sent to ${keypair.publicKey.toBase58()}`);
// 	} catch (error) {
// 		console.error("Error closing mint account:", error);
// 	}
// }
//
//
//
//

async function getPriceUpdateData() {
	// Fetch price update data from Hermes
	const priceServiceConnection = new HermesClient("https://hermes.pyth.network/", {});

	const EUR_TO_USD_FEED = "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b";
	const SOL_TO_USD_FEED = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

	const response = await priceServiceConnection.getLatestPriceUpdates([EUR_TO_USD_FEED, SOL_TO_USD_FEED], {
		encoding: "base64",
	});

	// console.log("devLib", devLib.getExplorerLink("address", "sfdd", "devnet"));
	return response.parsed; // response.binary.data;
}

// Function to define the token price
async function defineTokenPrice() {
	const EUR_TO_USD_FEED = "a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b";
	const SOL_TO_USD_FEED = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
	try {
		// Fetch price feed data
		const priceData = await getPriceUpdateData();

		// Extract EUR_TO_USD and SOL_TO_USD prices
		const eurToUsdPriceFeed = priceData.find((feed) => feed.id === EUR_TO_USD_FEED);
		const solToUsdPriceFeed = priceData.find((feed) => feed.id === SOL_TO_USD_FEED);

		if (!eurToUsdPriceFeed || !solToUsdPriceFeed) {
			throw new Error("Price feed data for EUR_TO_USD or SOL_TO_USD is missing.");
		}

		// Convert EUR_TO_USD price to a human-readable value
		const eurToUsdPrice = Number.parseFloat(eurToUsdPriceFeed.price.price) * 10 ** eurToUsdPriceFeed.price.expo;

		// Convert SOL_TO_USD price to a human-readable value
		const solToUsdPrice = Number.parseFloat(solToUsdPriceFeed.price.price) * 10 ** solToUsdPriceFeed.price.expo;

		console.log("EUR to USD Price:", eurToUsdPrice);
		console.log("SOL to USD Price:", solToUsdPrice);

		// Define the price of AAAADEV token
		// Since 1 AAAADEV = 1 EUR, the AAAADEV token price in USD is equal to EUR to USD exchange rate.
		const aaaaDevPriceInUsd = eurToUsdPrice;

		console.log("Price of 1 AAAADEV token in USD:", aaaaDevPriceInUsd);

		// Optionally, you can now update your token exchange rate on-chain using this price
		const exchangeRateDetails = {
			mintAddress: "EHQX2XmnFmgw1wTe9TJdt4Fzrzhg2AdaBC57tpe8cc25",
			symbol: "AAAADEV",
			priceInUsd: aaaaDevPriceInUsd,
			eurToUsdPrice,
			solToUsdPrice,
		};

		console.log("Exchange Rate Details for AAAADEV Token:", exchangeRateDetails);
		return exchangeRateDetails;
	} catch (error) {
		console.error("Error defining token price:", error);
		return null;
	}
}

async function main() {
	// await defineTokenPrice();
	// await initMintAndToken2022AccountAndMintTokensToAssociatedTokenAccount();
	await getPriceUpdateData();
	//
	// await revokeMintAuthorityTokenProgram2022();
	// await closeMintToken2022Account();
	// await closeMintPDA_();
	// await initToken()
	// await mintTokens();
	// await mintTokensWithToken2022Account();
	// await revokeMintAuthority()
	// await updateMetadata(newMetadata)
	// await updateTransferFee(3000)
	// await Testing()
}

async function beforeMain() {
	const network = await checkIfMainnet(connection);
	if (network) {
		promptToProceed();
	} else {
		console.log("\nYou are connected to Devnet 🧪 🔬 ");
	}
	console.log("\nProceeding with operations... 🥁 🥁 🥁\n");
}

console.log("Running client.");
beforeMain().then(() => {
	main().then(() => console.log("\n ✅️ Success!\n"));
});
