import * as fs from "node:fs";
import * as anchor from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import { type Connection, Keypair } from "@solana/web3.js";
import type * as web3 from "@solana/web3.js";
import readlineSync from "readline-sync";

export type CurrentNetwork = "mainnet" | "devnet";

export enum ExplorerName {
	SolanaFm = "solana.fm",
	SolanaExplorer = "solana.explorer",
	Solscan = "solscan",
}

//  Helper function to generate a keypair
export function generateKeypair(): Keypair | null {
	return Keypair.generate();
}

// Helper function to save a keypair
export function saveKeypair(keypair: Keypair, path: string) {
	fs.writeFileSync(path, JSON.stringify(Array.from(keypair.secretKey)));
	console.log(`keypair saved to ${path}`);
}

// Helper function to load a keypair
export function loadKeypair(path: string): Keypair | null {
	if (fs.existsSync(path)) {
		const secretKey = JSON.parse(fs.readFileSync(path, "utf8"));
		console.log("keypair Loaded !");
		return Keypair.fromSecretKey(Uint8Array.from(secretKey));
	}
	return null;
}

// Check if Keypair Exist to a given Path or Generate one new on that Path in .json file
export function checkOrGenerateSaveAndLoadKeypair(keypair: Keypair, path: string): Keypair | null {
	if (!keypair) {
		saveKeypair(generateKeypair(), path);
		return loadKeypair(path);
	}
	return null;
}

// Load a solana keypair from an id.json file
async function loadKeypairFromFile(filePath: string): Promise<Keypair> {
	try {
		const keypairData = JSON.parse(await fs.promises.readFile(filePath, "utf8"));
		return Keypair.fromSecretKey(Uint8Array.from(keypairData));
	} catch (error) {
		throw new Error(`Error loading keypair from file: ${error}`);
	}
}

// Helper function to create an associated token account
export async function createAssociatedTokenAccount(
	connection: anchor.web3.Connection,
	payer: web3.PublicKey,
	owner: web3.PublicKey,
	mint: web3.PublicKey,
): Promise<web3.PublicKey> {
	const associatedTokenAccount = await spl.getAssociatedTokenAddress(mint, owner);

	try {
		await spl.getAccount(connection, associatedTokenAccount);
		console.log(`Associated token account already exists: ${associatedTokenAccount.toBase58()}`);
	} catch {
		const createIx = spl.createAssociatedTokenAccountInstruction(payer, associatedTokenAccount, owner, mint);

		try {
			const transaction = new anchor.web3.Transaction().add(createIx);

			await anchor.AnchorProvider.env()
				.sendAndConfirm(transaction)
				.catch((e) => console.error(e));
			console.log("Transaction Done!");
			console.log(`Created associated token account: ${associatedTokenAccount.toBase58()}`);
		} catch (error) {
			console.error("Transaction failed with error:", {
				error: {
					message: error.message,
					logs: error.logs,
				},
			});
		}
	}

	return associatedTokenAccount;
}

// Helper function to check if you're on mainnet
export async function checkIfMainnet(connection?: Connection): Promise<boolean> {
	if (connection.rpcEndpoint.includes("mainnet-beta") || connection.rpcEndpoint.includes("mainnet")) {
		return true;
	}
	return false;
}

// Helper function to prompt the user
export function promptToProceed(): void {
	console.log("🚨🚨 You are currently connected to Mainnet! Please confirm you want to proceed... 🚨🚨");
	const proceed = readlineSync.keyInYNStrict('\nDo you want to proceed? Press "y" to proceed or "n" to cancel.');
	if (proceed === false) {
		console.log("\nTransaction cancelled. ❌ ❌\n");
		process.exit(0);
	}
}

export function showTransactionOnExplorer(
	tx: string,
	{ explorerName, network }: { explorerName: ExplorerName; network: "m" | "d" },
): string {
	const explorerClusters: Record<ExplorerName, { mainnet: string; devnet: string }> = {
		[ExplorerName.SolanaFm]: { mainnet: "mainnet-alpha", devnet: "devnet-solana" },
		[ExplorerName.SolanaExplorer]: { mainnet: "mainnet", devnet: "devnet" },
		[ExplorerName.Solscan]: { mainnet: "mainnet", devnet: "devnet" },
	};

	const cluster = network === "m" ? explorerClusters[explorerName].mainnet : explorerClusters[explorerName].devnet;
	const explorers: Record<ExplorerName, string> = {
		[ExplorerName.SolanaFm]: `https://solana.fm/tx/${tx}?cluster=${cluster}`,
		[ExplorerName.SolanaExplorer]: `https://explorer.solana.com/tx/${tx}?cluster=${cluster}`,
		[ExplorerName.Solscan]: `https://solscan.io/tx/${tx}?cluster=${cluster}`,
	};

	return explorers[explorerName];
}
