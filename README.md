# Solana Volume Bot
init.
A robust Electron desktop application for automated Solana volume trading with wallet safety as the top priority.

## Features

### Core Functionality
- **Continuous Volume Trading**: Automated buy/sell cycles with configurable intervals
- **Wallet Safety First**: All wallets are backed up with timestamps in the `wallet-backups` directory
- **Recovery System**: Complete fund recovery from all wallets across all backup files
- **Real-time Monitoring**: Live activity logs, statistics, and wallet balance tracking

### Wallet Management
- **Backup-First Architecture**: `wallet-backups` directory is the single source of truth
- **Automatic Backup Creation**: Every wallet operation creates timestamped backups
- **Wallet Overview**: View all wallets with balances, creation dates, and backup sources
- **Recovery Panel**: One-click recovery of all funds to main wallet

### Trading Features
- **Configurable Parameters**: Token address, buy amount, cycle interval, session duration
- **Sub-wallet Management**: Automatic creation/reuse of sub-wallets based on backups
- **Statistics Tracking**: Cycles completed, total volume, success rate, fees
- **Activity Logging**: Real-time logs with transaction details and error tracking

## Installation

1. **Clone or Download** this project to your desired location
2. **Install Dependencies**:
   ```bash
   npm install
   ```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## Configuration

### Trading Parameters
- **Token Address**: Solana token contract address for trading
- **Main Wallet Private Key**: Your main wallet's private key (keep secure!)
- **Number of Sub-wallets**: How many sub-wallets to use (creates if needed)
- **Buy Amount**: SOL amount per buy transaction
- **Cycle Interval**: Time between trading cycles (seconds)
- **Session Duration**: How long to run the bot (minutes)

### Wallet Safety
- All wallets are automatically backed up to `wallet-backups/wallets-<timestamp>.json`
- The app always scans all backup files to ensure no wallet is lost
- Recovery functionality works across all backup files, even after reinstalls

## Architecture

### File Structure
```
src/
├── main.ts                 # Electron main process
├── services/
│   ├── BackupManager.ts    # Wallet backup management
│   ├── WalletManager.ts    # Wallet operations and Solana interactions
│   └── TradingBot.ts       # Trading logic and cycle management
renderer/
├── index.html              # Main UI
└── renderer.js             # Frontend logic
wallet-backups/             # Wallet backup files (auto-created)
└── wallets-<timestamp>.json
```

### Services Overview

#### BackupManager
- Creates timestamped wallet backups
- Scans and reads all backup files
- Deduplicates wallets across backups
- Ensures wallet data persistence

#### WalletManager
- Creates and manages Solana wallets
- Handles balance checking and fund distribution
- Implements complete fund recovery
- Uses backups as the authoritative source

#### TradingBot
- Executes continuous volume trading cycles
- Manages trading statistics and logging
- Handles session timeouts and cleanup
- Integrates with Jupiter API (placeholder implemented)

## Security Notes

⚠️ **Important Security Considerations**:
- Keep your private keys secure and never share them
- The app stores private keys in backup files - secure your backup directory
- Use testnet for initial testing
- Ensure you have sufficient SOL for trading and fees

## Trading Strategy

This bot implements **continuous volume trading**:
1. Distributes funds from main wallet to sub-wallets
2. Each cycle: all sub-wallets perform buy → sell
3. Funds remain in sub-wallets for next cycle
4. At session end or stop, all funds return to main wallet
5. Focus on volume generation, not profit optimization

## Recovery System

The recovery system is designed to be bulletproof:
- Scans ALL backup files in `wallet-backups/`
- Recovers from ALL wallets ever created
- Works even after app crashes or reinstalls
- Provides detailed recovery logs
- Leaves small amounts for transaction fees

## Limitations & Development Notes

- **Jupiter Integration**: Currently uses placeholder transactions
- **Network**: Configured for Solana mainnet (change for testnet)
- **Fee Optimization**: Basic fee handling (can be optimized)
- **Error Handling**: Robust but can be enhanced for edge cases

## Development Roadmap

1. **Jupiter API Integration**: Real token swapping
2. **Advanced Fee Management**: Dynamic fee optimization
3. **Multiple Token Support**: Trading multiple tokens simultaneously
4. **Enhanced Recovery**: More granular recovery options
5. **Security Enhancements**: Hardware wallet integration

## Contributing

This is a production-focused application. Ensure all changes maintain the wallet safety principles and backup-first architecture.

## License

MIT License - Use at your own risk. Cryptocurrency trading involves risk.
