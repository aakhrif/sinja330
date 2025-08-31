<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
# Solana Volume Bot - Electron Application

This is a robust Electron desktop application for automated Solana volume trading with wallet safety as the top priority.

## Project Status: COMPLETED ✅

### Key Features Implemented:
- **Wallet-First Architecture**: All wallets are backed up with timestamps in the `wallet-backups` directory
- **Complete Fund Recovery**: Recovers funds from all wallets across all backup files  
- **Continuous Volume Trading**: Automated buy/sell cycles with configurable parameters
- **Real-time Monitoring**: Live activity logs, statistics, and wallet balance tracking
- **TailwindCSS UI**: Professional interface with tabs for Trading, Wallets, Recovery, and Backups

### Technical Implementation:
- **Backend Services**: BackupManager, WalletManager, TradingBot with full TypeScript support
- **Solana Integration**: Uses @solana/web3.js for blockchain interactions
- **Electron Framework**: Desktop application with IPC communication
- **Safety First**: Wallet backups are the single source of truth for all operations

### Development Commands:
```bash
npm run dev      # Start in development mode
npm run build    # Compile TypeScript
npm start        # Run production build
```

### Architecture:
- `src/main.ts` - Electron main process
- `src/services/` - Core business logic (BackupManager, WalletManager, TradingBot)
- `renderer/` - Frontend UI with HTML/JS
- `wallet-backups/` - Automatic wallet backup storage

The application is ready for use and testing. All core requirements have been implemented with robust error handling and wallet safety mechanisms.
