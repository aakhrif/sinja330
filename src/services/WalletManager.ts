import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { EventEmitter } from 'events';
import * as bs58 from 'bs58';
import { BackupManager, WalletBackup } from './BackupManager';

export interface WalletInfo {
  publicKey: string;
  privateKey: string;
  balance: number;
  createdAt: number;
  backupFile?: string;
  index?: number;
}

export interface WalletBalances {
  mainWallet?: WalletInfo;
  subWallets: WalletInfo[];
  totalBalance: number;
  lastUpdated: number;
}

export class WalletManager extends EventEmitter {
  private connection: Connection;
  private backupManager: BackupManager;

  constructor(backupManager: BackupManager) {
    super();
    this.backupManager = backupManager;
    // Using Solana mainnet RPC endpoint
    this.connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  }

  public async createSubWallets(count: number): Promise<{ success: boolean; wallets?: WalletInfo[]; error?: string }> {
    try {
      // Get existing wallets from backups
      const existingWallets = await this.backupManager.getAllWalletsFromBackups();
      const currentSubWalletCount = existingWallets.subWallets.length;

      if (currentSubWalletCount >= count) {
        // Return the first 'count' sub-wallets
        const selectedWallets = existingWallets.subWallets
          .slice(0, count)
          .map(wallet => ({
            publicKey: wallet.publicKey,
            privateKey: wallet.privateKey,
            balance: 0,
            createdAt: wallet.createdAt,
            backupFile: wallet.backupFile,
            index: wallet.index
          }));

        return { success: true, wallets: selectedWallets };
      }

      // Need to create additional wallets
      const walletsToCreate = count - currentSubWalletCount;
      const newWallets: WalletBackup['subWallets'] = [];

      for (let i = 0; i < walletsToCreate; i++) {
        const keypair = Keypair.generate();
        const wallet = {
          publicKey: keypair.publicKey.toString(),
          privateKey: bs58.encode(keypair.secretKey),
          createdAt: Date.now(),
          index: currentSubWalletCount + i
        };
        newWallets.push(wallet);
      }

      // Create backup with new wallets
      await this.backupManager.updateBackupWithNewWallets(
        existingWallets.subWallets,
        newWallets
      );

      // Return all sub-wallets (existing + new)
      const allSubWallets = [...existingWallets.subWallets, ...newWallets]
        .slice(0, count)
        .map(wallet => ({
          publicKey: wallet.publicKey,
          privateKey: wallet.privateKey,
          balance: 0,
          createdAt: wallet.createdAt,
          index: wallet.index
        }));

      this.emit('wallet-update', { subWallets: allSubWallets });
      
      return { success: true, wallets: allSubWallets };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  public async getAllWallets(): Promise<{
    mainWallets: WalletInfo[];
    subWallets: WalletInfo[];
    totalWallets: number;
  }> {
    try {
      console.log('🔍 Getting all wallets from all backup files...');
      const walletsFromBackups = await this.backupManager.getAllWalletsFromBackups();
      
      console.log(`📁 Found ${walletsFromBackups.mainWallets.length} main wallets from backups`);
      console.log(`📁 Found ${walletsFromBackups.subWallets.length} sub-wallets from backups`);
      
      // Log all sub-wallets for debugging
      walletsFromBackups.subWallets.forEach((wallet, index) => {
        console.log(`  Sub-wallet ${index + 1}: ${wallet.publicKey.substring(0, 8)}... from ${wallet.backupFile}`);
      });
      
      const mainWallets: WalletInfo[] = walletsFromBackups.mainWallets.map(wallet => ({
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey,
        balance: 0,
        createdAt: wallet.createdAt,
        backupFile: wallet.backupFile
      }));

      const subWallets: WalletInfo[] = walletsFromBackups.subWallets.map(wallet => ({
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey,
        balance: 0,
        createdAt: wallet.createdAt,
        backupFile: wallet.backupFile,
        index: wallet.index
      }));

      console.log(`✅ Returning ${mainWallets.length} main wallets and ${subWallets.length} sub-wallets`);

      return {
        mainWallets,
        subWallets,
        totalWallets: mainWallets.length + subWallets.length
      };
    } catch (error) {
      console.error('Error getting all wallets:', error);
      return { mainWallets: [], subWallets: [], totalWallets: 0 };
    }
  }

  public async getWalletBalances(): Promise<WalletBalances> {
    try {
      const wallets = await this.getAllWallets();
      let totalBalance = 0;

      // Get balances for main wallets
      const mainWalletsWithBalance = await Promise.all(
        wallets.mainWallets.filter(wallet => wallet.publicKey).map(async (wallet) => {
          const balance = await this.getBalance(wallet.publicKey);
          totalBalance += balance;
          return { ...wallet, balance };
        })
      );

      // Get balances for sub wallets
      const subWalletsWithBalance = await Promise.all(
        wallets.subWallets.filter(wallet => wallet.publicKey).map(async (wallet) => {
          const balance = await this.getBalance(wallet.publicKey);
          totalBalance += balance;
          return { ...wallet, balance };
        })
      );

      return {
        mainWallet: mainWalletsWithBalance[0],
        subWallets: subWalletsWithBalance,
        totalBalance,
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error('Error getting wallet balances:', error);
      return {
        subWallets: [],
        totalBalance: 0,
        lastUpdated: Date.now()
      };
    }
  }

  private async getBalance(publicKeyString: string): Promise<number> {
    try {
      if (!publicKeyString) {
        console.warn('Empty public key provided to getBalance');
        return 0;
      }
      
      const publicKey = new PublicKey(publicKeyString);
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error(`Error getting balance for ${publicKeyString}:`, error);
      return 0;
    }
  }

  public async recoverAllFunds(mainWalletPrivateKey: string, tokenAddress?: string): Promise<{
    success: boolean;
    recoveredAmount?: number;
    transactions?: string[];
    error?: string;
  }> {
    try {
      console.log(`Starting fund recovery...`);
      
      if (!mainWalletPrivateKey || mainWalletPrivateKey.length < 50) {
        return { success: false, error: 'Invalid main wallet private key' };
      }

      const mainKeypair = Keypair.fromSecretKey(bs58.decode(mainWalletPrivateKey));
      const wallets = await this.getAllWallets();
      const transactions: string[] = [];
      let totalRecovered = 0;

      console.log(`Main wallet: ${mainKeypair.publicKey.toString()}`);
      console.log(`Found ${wallets.subWallets.length} sub-wallets to recover from`);

      // Process each sub-wallet: first sell tokens, then transfer SOL
      for (let i = 0; i < wallets.subWallets.length; i++) {
        const wallet = wallets.subWallets[i];
        const walletShort = wallet.publicKey.substring(0, 8);
        
        try {
          console.log(`[${i + 1}/${wallets.subWallets.length}] Processing wallet ${walletShort}...`);
          
          const sourceKeypair = Keypair.fromSecretKey(bs58.decode(wallet.privateKey));
          
          // Step 1: Sell tokens if any (only if tokenAddress provided)
          if (tokenAddress) {
            try {
              console.log(`  Checking for tokens in ${walletShort}...`);
              const sellResult = await this.sellTokensFromWallet(sourceKeypair, tokenAddress);
              if (sellResult.success) {
                console.log(`  ✓ Sold tokens from ${walletShort}: ${sellResult.solReceived} SOL`);
                transactions.push(...(sellResult.transactions || []));
                
                // Wait 2 seconds for transaction to settle
                await new Promise(resolve => setTimeout(resolve, 2000));
              } else {
                console.log(`  ⚠ No tokens to sell in ${walletShort}`);
              }
            } catch (error) {
              console.log(`  ⚠ Token sell failed for ${walletShort}:`, error);
            }
          }

          // Step 2: Transfer all SOL (wait a bit first to ensure balance is updated)
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const balance = await this.getBalance(wallet.publicKey);
          console.log(`  SOL balance in ${walletShort}: ${balance.toFixed(6)} SOL`);
          
          if (balance > 0.000001) { // Minimal threshold - 1000 lamports
            // Calculate transfer amount with minimal fee
            const feeInSol = 0.000001; // Minimal transaction fee
            const transferableAmount = balance - feeInSol;
            const transferLamports = Math.floor(transferableAmount * LAMPORTS_PER_SOL);

            if (transferLamports > 0) {
              console.log(`  Transferring ${transferableAmount.toFixed(6)} SOL from ${walletShort}...`);

              const transaction = new Transaction().add(
                SystemProgram.transfer({
                  fromPubkey: sourceKeypair.publicKey,
                  toPubkey: mainKeypair.publicKey,
                  lamports: transferLamports,
                })
              );

              // Get fresh blockhash with minimal commitment
              const { blockhash } = await this.connection.getLatestBlockhash('finalized');
              transaction.recentBlockhash = blockhash;
              transaction.feePayer = sourceKeypair.publicKey;

              transaction.sign(sourceKeypair);
              
              // Send with minimal settings for lowest fees
              const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
                skipPreflight: true, // Skip preflight to save on fees
                preflightCommitment: 'finalized',
                maxRetries: 1
              });

              // Wait for confirmation
              await this.connection.confirmTransaction(signature, 'finalized');

              transactions.push(signature);
              totalRecovered += transferableAmount;
              console.log(`  ✓ Recovered ${transferableAmount.toFixed(6)} SOL from ${walletShort}`);
            } else {
              console.log(`  ⚠ Amount too small to transfer from ${walletShort}`);
            }
          } else {
            console.log(`  ⚠ Insufficient balance in ${walletShort} (${balance.toFixed(6)} SOL)`);
          }

          // Wait between wallets to avoid rate limits
          if (i < wallets.subWallets.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }

        } catch (error) {
          console.error(`  ✗ Failed to process wallet ${walletShort}:`, error);
          // Continue with next wallet
        }
      }

      console.log(`\n✓ Recovery completed: ${totalRecovered.toFixed(6)} SOL recovered from ${transactions.length} transactions`);
      return { 
        success: true, 
        recoveredAmount: totalRecovered, 
        transactions 
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Recovery error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  private async sellTokensFromWallet(walletKeypair: Keypair, tokenAddress: string): Promise<{
    success: boolean;
    solReceived?: number;
    transactions?: string[];
  }> {
    try {
      // Import Jupiter API
      const axios = (await import('axios')).default;
      
      // Get token balance
      const tokenMint = new PublicKey(tokenAddress);
      const tokenAccountAddress = await getAssociatedTokenAddress(tokenMint, walletKeypair.publicKey);
      
      try {
        const tokenAccount = await this.connection.getTokenAccountBalance(tokenAccountAddress);
        const tokenBalance = tokenAccount.value.uiAmount;
        
        if (!tokenBalance || tokenBalance <= 0) {
          return { success: false };
        }

        console.log(`    Found ${tokenBalance} tokens to sell`);

        // Get Jupiter quote for selling tokens
        const quoteResponse = await axios.get(`https://quote-api.jup.ag/v6/quote`, {
          params: {
            inputMint: tokenAddress,
            outputMint: 'So11111111111111111111111111111111111111112', // SOL
            amount: tokenAccount.value.amount,
            slippageBps: 10 // 3% slippage
          }
        });

        if (!quoteResponse.data) {
          return { success: false };
        }

        // Get swap transaction
        const swapResponse = await axios.post('https://quote-api.jup.ag/v6/swap', {
          quoteResponse: quoteResponse.data,
          userPublicKey: walletKeypair.publicKey.toString(),
          wrapAndUnwrapSol: true,
          computeUnitPriceMicroLamports: 1 // Minimal compute unit price
        });

        const { swapTransaction } = swapResponse.data;
        const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

        transaction.sign([walletKeypair]);

        // Send transaction with minimal fees
        const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
          skipPreflight: true,
          maxRetries: 1
        });

        await this.connection.confirmTransaction(signature, 'finalized');

        const solReceived = parseInt(quoteResponse.data.outAmount) / LAMPORTS_PER_SOL;
        return { 
          success: true, 
          solReceived, 
          transactions: [signature] 
        };

      } catch (tokenError) {
        // No token account exists or no tokens
        return { success: false };
      }

    } catch (error) {
      return { success: false };
    }
  }

  public async distributeToSubWallets(
    mainWalletPrivateKey: string,
    subWalletAddresses: string[],
    amountPerWallet: number
  ): Promise<{ success: boolean; transactions?: string[]; fundedWallets?: string[]; error?: string }> {
    try {
      const mainKeypair = Keypair.fromSecretKey(bs58.decode(mainWalletPrivateKey));
      const transactions: string[] = [];
      const fundedWallets: string[] = [];

      // Check main wallet balance before starting
      const mainBalance = await this.connection.getBalance(mainKeypair.publicKey);
      const mainBalanceSOL = mainBalance / LAMPORTS_PER_SOL;
      const totalNeeded = (amountPerWallet * subWalletAddresses.length) + 0.00001; // Minimal transaction fees
      
      console.log(`📊 Main wallet balance: ${mainBalanceSOL.toFixed(6)} SOL`);
      console.log(`💰 Total needed: ${totalNeeded.toFixed(6)} SOL for ${subWalletAddresses.length} wallets`);
      
      if (mainBalanceSOL < totalNeeded) {
        return { 
          success: false, 
          error: `Insufficient balance: Have ${mainBalanceSOL.toFixed(6)} SOL, need ${totalNeeded.toFixed(6)} SOL` 
        };
      }

      for (let i = 0; i < subWalletAddresses.length; i++) {
        const address = subWalletAddresses[i];
        try {
          // Check balance before each transaction
          const currentBalance = await this.connection.getBalance(mainKeypair.publicKey);
          const currentBalanceSOL = currentBalance / LAMPORTS_PER_SOL;
          
          if (currentBalanceSOL < amountPerWallet + 0.0005) { // Minimal transaction fee buffer
            console.error(`❌ [${i+1}/${subWalletAddresses.length}] Insufficient balance for ${address}: ${currentBalanceSOL.toFixed(6)} SOL`);
            continue; // Skip this wallet
          }

          console.log(`💸 [${i+1}/${subWalletAddresses.length}] Sending ${amountPerWallet} SOL to ${address}...`);

          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: mainKeypair.publicKey,
              toPubkey: new PublicKey(address),
              lamports: Math.floor(amountPerWallet * LAMPORTS_PER_SOL),
            })
          );

          // Get recent blockhash
          const { blockhash } = await this.connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = mainKeypair.publicKey;

          // Sign and send transaction
          transaction.sign(mainKeypair);
          const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 3
          });

          // Wait for confirmation
          await this.connection.confirmTransaction(signature, 'confirmed');

          transactions.push(signature);
          fundedWallets.push(address);
          console.log(`✅ Distributed ${amountPerWallet} SOL to ${address}`);
        } catch (error) {
          console.error(`❌ Failed to distribute to ${address}:`, error);
          // Continue with next wallet - don't add to fundedWallets
        }
      }

      const successfullyFunded = fundedWallets.length;
      const totalRequested = subWalletAddresses.length;
      
      console.log(`✓ Successfully funded ${successfullyFunded}/${totalRequested} wallets`);

      return { 
        success: successfullyFunded > 0, // Success if at least one wallet was funded
        transactions, 
        fundedWallets 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  public getConnection(): Connection {
    return this.connection;
  }
}
