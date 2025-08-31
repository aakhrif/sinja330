import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { WalletManager } from './services/WalletManager';
import { TradingBot } from './services/TradingBot';
import { BackupManager } from './services/BackupManager';
import { LicenseManager } from './services/LicenseManager';

class MainProcess {
  private mainWindow: BrowserWindow | null = null;
  private walletManager: WalletManager;
  private tradingBot: TradingBot;
  private backupManager: BackupManager;

  constructor() {
    this.backupManager = new BackupManager();
    this.walletManager = new WalletManager(this.backupManager);
    this.tradingBot = new TradingBot(this.walletManager, this.backupManager);
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    app.whenReady().then(() => {
      this.createWindow();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    this.setupIpcHandlers();
  }

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      icon: path.join(__dirname, '../assets/icon.png'),
      title: 'TradeSphere Volume Bot'
    });

    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Only open DevTools if explicitly requested with --inspect flag
    if (process.argv.includes('--inspect')) {
      this.mainWindow.webContents.openDevTools();
    }
  }

  private setupIpcHandlers(): void {
    // Wallet operations
    ipcMain.handle('get-all-wallets', async () => {
      try {
        return await this.walletManager.getAllWallets();
      } catch (error) {
        console.error('Error getting wallets:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    });

    ipcMain.handle('create-subwallets', async (_event, count: number) => {
      try {
        return await this.walletManager.createSubWallets(count);
      } catch (error) {
        console.error('Error creating subwallets:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    });

    ipcMain.handle('get-wallet-balances', async () => {
      try {
        return await this.walletManager.getWalletBalances();
      } catch (error) {
        console.error('Error getting balances:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    });

    // License validation
    ipcMain.handle('validate-license', async (_event, licenseKey: string) => {
      try {
        const validation = LicenseManager.validateLicenseKey(licenseKey);
        return validation;
      } catch (error) {
        console.error('Error validating license:', error);
        return { valid: false, error: 'Failed to validate license key' };
      }
    });

    // Trading bot operations
    ipcMain.handle('start-bot', async (_event, config: any) => {
      try {
        return await this.tradingBot.start(config);
      } catch (error) {
        console.error('Error starting bot:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    });

    ipcMain.handle('stop-bot', async () => {
      try {
        return await this.tradingBot.stop();
      } catch (error) {
        console.error('Error stopping bot:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    });

    ipcMain.handle('get-bot-status', async () => {
      try {
        return this.tradingBot.getStatus();
      } catch (error) {
        console.error('Error getting bot status:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    });

    ipcMain.handle('get-bot-stats', async () => {
      try {
        return this.tradingBot.getStats();
      } catch (error) {
        console.error('Error getting bot stats:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    });

    // Recovery operations
    ipcMain.handle('recover-all-funds', async (_event, mainWalletPrivateKey: string, tokenAddress?: string) => {
      try {
        return await this.walletManager.recoverAllFunds(mainWalletPrivateKey, tokenAddress);
      } catch (error) {
        console.error('Error recovering funds:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    });

    // Backup operations
    ipcMain.handle('get-backup-files', async () => {
      try {
        return await this.backupManager.getBackupFiles();
      } catch (error) {
        console.error('Error getting backup files:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    });

    // Event forwarding from services to renderer
    this.tradingBot.on('log', (log: any) => {
      this.mainWindow?.webContents.send('bot-log', log);
    });

    this.tradingBot.on('stats-update', (stats: any) => {
      this.mainWindow?.webContents.send('stats-update', stats);
    });

    this.walletManager.on('wallet-update', (wallets: any) => {
      this.mainWindow?.webContents.send('wallet-update', wallets);
    });
  }
}

new MainProcess();
