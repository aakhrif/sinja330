import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface WalletBackup {
  timestamp: number;
  mainWallet?: {
    publicKey: string;
    privateKey: string;
    createdAt: number;
  };
  subWallets: Array<{
    publicKey: string;
    privateKey: string;
    createdAt: number;
    index: number;
  }>;
  metadata: {
    version: string;
    createdBy: string;
    totalWallets: number;
  };
}

export interface BackupFile {
  filename: string;
  path: string;
  timestamp: number;
  data: WalletBackup;
}

export class BackupManager extends EventEmitter {
  private backupDir: string;

  constructor() {
    super();
    this.backupDir = path.join(process.cwd(), 'wallet-backups');
    this.ensureBackupDirectory();
  }

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.backupDir);
    } catch {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`Created wallet-backups directory: ${this.backupDir}`);
    }
  }

  public async createBackup(walletData: Omit<WalletBackup, 'timestamp' | 'metadata'>): Promise<string> {
    const timestamp = Date.now();
    const backup: WalletBackup = {
      timestamp,
      ...walletData,
      metadata: {
        version: '1.0.0',
        createdBy: 'solana-volume-bot',
        totalWallets: (walletData.mainWallet ? 1 : 0) + walletData.subWallets.length
      }
    };

    const filename = `wallets-${timestamp}.json`;
    const filepath = path.join(this.backupDir, filename);
    
    try {
      await fs.writeFile(filepath, JSON.stringify(backup, null, 2));
      console.log(`Wallet backup created: ${filename}`);
      this.emit('backup-created', { filename, filepath, backup });
      return filepath;
    } catch (error) {
      console.error('Failed to create backup:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create wallet backup: ${errorMessage}`);
    }
  }

  public async getBackupFiles(): Promise<BackupFile[]> {
    try {
      await this.ensureBackupDirectory();
      const files = await fs.readdir(this.backupDir);
      const backupFiles: BackupFile[] = [];

      for (const filename of files) {
        if (filename.startsWith('wallets-') && filename.endsWith('.json')) {
          const filepath = path.join(this.backupDir, filename);
          try {
            const data = await fs.readFile(filepath, 'utf-8');
            const rawBackup = JSON.parse(data);
            
            // Convert old format to new format if needed
            const backup: WalletBackup = this.normalizeBackupFormat(rawBackup, filename);
            
            backupFiles.push({
              filename,
              path: filepath,
              timestamp: backup.timestamp,
              data: backup
            });
          } catch (error) {
            console.error(`Failed to read backup file ${filename}:`, error);
          }
        }
      }

      // Sort by timestamp (newest first)
      return backupFiles.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to get backup files:', error);
      return [];
    }
  }

  private normalizeBackupFormat(rawBackup: any, filename: string): WalletBackup {
    // If it's already in the new format
    if (rawBackup.metadata && rawBackup.timestamp && rawBackup.mainWallet) {
      return rawBackup as WalletBackup;
    }

    // Convert old format to new format
    const timestamp = rawBackup.timestamp || rawBackup.createdAt ? new Date(rawBackup.createdAt || rawBackup.timestamp).getTime() : Date.now();
    
    // Handle main wallet - ensure it exists in all backup files
    let mainWallet: WalletBackup['mainWallet'] = undefined;
    if (rawBackup.mainWallet && typeof rawBackup.mainWallet === 'object') {
      mainWallet = {
        publicKey: rawBackup.mainWallet.publicKey,
        privateKey: rawBackup.mainWallet.privateKey,
        createdAt: rawBackup.mainWallet.createdAt ? new Date(rawBackup.mainWallet.createdAt).getTime() : timestamp
      };
    } else if (!rawBackup.mainWallet) {
      // If no main wallet is defined, use a placeholder (this should be filled by user)
      console.warn(`Backup file ${filename} has no main wallet defined - using placeholder`);
      mainWallet = {
        publicKey: "9q36V4YA4wNbywXzttshrKfAursbwVUv5F4zHZ1DbTFs", // Default placeholder
        privateKey: "REPLACE_WITH_YOUR_MAIN_WALLET_PRIVATE_KEY_HERE",
        createdAt: timestamp
      };
    }

    // Handle sub wallets
    const subWallets = (rawBackup.subWallets || []).map((wallet: any, index: number) => ({
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
      createdAt: wallet.createdAt ? new Date(wallet.createdAt).getTime() : timestamp,
      index: wallet.index !== undefined ? wallet.index : index
    }));

    return {
      timestamp,
      mainWallet,
      subWallets,
      metadata: {
        version: rawBackup.version || '1.0.0',
        createdBy: 'solana-volume-bot',
        totalWallets: (mainWallet ? 1 : 0) + subWallets.length
      }
    };
  }

  public async getAllWalletsFromBackups(): Promise<{
    mainWallets: Array<WalletBackup['mainWallet'] & { backupFile: string; timestamp: number }>;
    subWallets: Array<WalletBackup['subWallets'][0] & { backupFile: string; timestamp: number }>;
  }> {
    const backupFiles = await this.getBackupFiles();
    const mainWallets: any[] = [];
    const subWallets: any[] = [];

    for (const backupFile of backupFiles) {
      if (backupFile.data.mainWallet) {
        mainWallets.push({
          ...backupFile.data.mainWallet,
          backupFile: backupFile.filename,
          timestamp: backupFile.timestamp
        });
      }

      for (const subWallet of backupFile.data.subWallets) {
        subWallets.push({
          ...subWallet,
          backupFile: backupFile.filename,
          timestamp: backupFile.timestamp
        });
      }
    }

    // Deduplicate wallets by public key
    const uniqueMainWallets = mainWallets.filter((wallet, index, array) => 
      array.findIndex(w => w.publicKey === wallet.publicKey) === index
    );

    const uniqueSubWallets = subWallets.filter((wallet, index, array) => 
      array.findIndex(w => w.publicKey === wallet.publicKey) === index
    );

    return {
      mainWallets: uniqueMainWallets,
      subWallets: uniqueSubWallets
    };
  }

  public async getLatestBackup(): Promise<BackupFile | null> {
    const backupFiles = await this.getBackupFiles();
    return backupFiles.length > 0 ? backupFiles[0] : null;
  }

  public async updateBackupWithNewWallets(
    existingWallets: WalletBackup['subWallets'],
    newWallets: WalletBackup['subWallets']
  ): Promise<string> {
    const allWallets = [...existingWallets, ...newWallets];
    
    return await this.createBackup({
      subWallets: allWallets
    });
  }

  public getBackupDirectory(): string {
    return this.backupDir;
  }
}
