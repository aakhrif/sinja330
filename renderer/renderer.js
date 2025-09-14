const { ipcRenderer } = require('electron');

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadConfig();
    switchTab('trading'); // Start with trading tab active
    updateBotStatusFromServer(); // Check current bot status
});

// Get bot status from server
async function updateBotStatusFromServer() {
    try {
        const status = await ipcRenderer.invoke('get-bot-status');
        if (status.isRunning) {
            updateButtonStates(true);
            startStatsPolling();
        } else {
            updateButtonStates(false);
            stopStatsPolling();
        }
    } catch (error) {
        console.error('Error getting bot status:', error);
    }
}

// Tab switching function
function switchTab(tabName) {
    // Hide all tab contents
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(button => {
        button.classList.remove('active', 'border-white');
        button.classList.add('border-transparent');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.style.display = 'block';
        selectedTab.classList.add('active');
    }
    
    // Activate selected button
    const selectedButton = document.querySelector(`button[onclick="switchTab('${tabName}')"]`);
    if (selectedButton) {
        selectedButton.classList.add('active', 'border-white');
        selectedButton.classList.remove('border-transparent');
    }
    
    // Load content for specific tabs
    if (tabName === 'wallets') {
        refreshWallets();
    } else if (tabName === 'backups') {
        refreshBackups();
    }
}

// Config functions
function saveConfig() {
    const config = {
        tokenAddress: document.getElementById('tokenAddress').value,
        mainWalletPrivateKey: document.getElementById('mainWalletKey').value,
        numberOfSubWallets: parseInt(document.getElementById('subWalletCount').value),
        buyAmount: parseFloat(document.getElementById('buyAmount').value),
        sessionDuration: 999, // Fixed for continuous trading
        licenseKey: document.getElementById('licenseKey').value
        // cycleInterval entfernt - kontinuierliches Trading
    };
    
    localStorage.setItem('volumeBotConfig', JSON.stringify(config));
    document.getElementById('recoveryMainWalletKey').value = config.mainWalletPrivateKey;
    addLog('Configuration saved successfully', 'success');
}

function loadConfig() {
    const saved = localStorage.getItem('volumeBotConfig');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            document.getElementById('tokenAddress').value = config.tokenAddress || '';
            document.getElementById('mainWalletKey').value = config.mainWalletPrivateKey || '';
            document.getElementById('subWalletCount').value = config.numberOfSubWallets || '';
            document.getElementById('buyAmount').value = config.buyAmount || '0.005';
            // cycleInterval wird nicht mehr geladen - kontinuierliches Trading
            // sessionDuration wird nicht mehr geladen - kontinuierliches Trading
            document.getElementById('licenseKey').value = config.licenseKey || '';
            document.getElementById('recoveryMainWalletKey').value = config.mainWalletPrivateKey || '';
            
            // Validate license if present
            if (config.licenseKey) {
                validateLicenseUI(config.licenseKey);
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
    }
}

// Bot control functions
async function startBot() {
    const config = {
        tokenAddress: document.getElementById('tokenAddress').value,
        mainWalletPrivateKey: document.getElementById('mainWalletKey').value,
        numberOfSubWallets: parseInt(document.getElementById('subWalletCount').value),
        buyAmount: parseFloat(document.getElementById('buyAmount').value),
        sessionDuration: 999, // Fixed value for continuous trading
        licenseKey: document.getElementById('licenseKey').value
        // cycleInterval entfernt - kontinuierliches Trading
    };

    if (!config.tokenAddress || !config.mainWalletPrivateKey || !config.licenseKey) {
        alert('Please fill in all required fields including the license key.');
        return;
    }

    try {
        const result = await ipcRenderer.invoke('start-bot', config);
        if (result.success) {
            addLog('Trading bot started successfully', 'success');
            updateButtonStates(true);
            startStatsPolling(); // Start live stats updates
        } else {
            addLog(`Failed to start bot: ${result.error}`, 'error');
        }
    } catch (error) {
        addLog(`Error starting bot: ${error.message}`, 'error');
    }
}

async function stopBot() {
    try {
        const result = await ipcRenderer.invoke('stop-bot');
        if (result.success) {
            addLog('Trading bot stopped successfully', 'success');
            updateButtonStates(false);
            stopStatsPolling(); // Stop live stats updates
        } else {
            addLog(`Failed to stop bot: ${result.error}`, 'error');
        }
    } catch (error) {
        addLog(`Error stopping bot: ${error.message}`, 'error');
    }
}

function updateButtonStates(running) {
    const startBtn = document.getElementById('startBot');
    const stopBtn = document.getElementById('stopBot');
    const statusText = document.getElementById('statusText');
    
    if (running) {
        startBtn.disabled = true;
        startBtn.textContent = 'Running...';
        stopBtn.disabled = false;
        statusText.textContent = 'Running';
    } else {
        startBtn.disabled = false;
        startBtn.textContent = 'Start Bot';
        stopBtn.disabled = true;
        statusText.textContent = 'Stopped';
    }
}

// Stats polling for live updates
let statsInterval = null;

function startStatsPolling() {
    if (statsInterval) {
        clearInterval(statsInterval);
    }
    
    // Update stats every 5 seconds
    statsInterval = setInterval(async () => {
        try {
            const stats = await ipcRenderer.invoke('get-bot-stats');
            updateStatsDisplay(stats);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    }, 5000);
    
    // Initial stats update
    updateStatsImmediate();
}

function stopStatsPolling() {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
}

async function updateStatsImmediate() {
    try {
        const stats = await ipcRenderer.invoke('get-bot-stats');
        updateStatsDisplay(stats);
    } catch (error) {
        console.error('Error fetching immediate stats:', error);
    }
}

function updateStatsDisplay(stats) {
    if (document.getElementById('cyclesCompleted')) {
        document.getElementById('cyclesCompleted').textContent = stats.cyclesCompleted || 0;
        document.getElementById('totalVolume').textContent = (stats.totalVolume || 0).toFixed(4);
        document.getElementById('successRate').textContent = `${(stats.successRate || 0).toFixed(1)}%`;
        document.getElementById('totalFees').textContent = (stats.totalFees || 0).toFixed(6);
        
        // Update uptime if available
        if (stats.sessionStartTime && document.getElementById('uptime')) {
            const uptime = Date.now() - stats.sessionStartTime;
            const hours = Math.floor(uptime / 3600000);
            const minutes = Math.floor((uptime % 3600000) / 60000);
            const seconds = Math.floor((uptime % 60000) / 1000);
            document.getElementById('uptime').textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
}

// Recovery function
async function startRecovery() {
    const mainWalletKey = document.getElementById('recoveryMainWalletKey').value;
    
    if (!mainWalletKey) {
        alert('Main wallet private key is required.');
        return;
    }

    if (!confirm('Are you sure you want to recover all funds?')) {
        return;
    }

    try {
        const tokenAddress = document.getElementById('tokenAddress').value;
        const result = await ipcRenderer.invoke('recover-all-funds', mainWalletKey, tokenAddress);
        
        if (result.success) {
            addRecoveryLog(`Recovery completed: ${result.recoveredAmount?.toFixed(6)} SOL recovered`);
            refreshWallets();
        } else {
            addRecoveryLog(`Recovery failed: ${result.error}`);
        }
    } catch (error) {
        addRecoveryLog(`Recovery error: ${error.message}`);
    }
}

// Wallet functions
async function refreshWallets() {
    try {
        const wallets = await ipcRenderer.invoke('get-all-wallets');
        
        // Get live balances
        try {
            const balances = await ipcRenderer.invoke('get-wallet-balances');
            // Update wallet objects with live balances
            if (balances && balances.wallets) {
                wallets.mainWallets.forEach(wallet => {
                    const liveBalance = balances.wallets.find(b => b.publicKey === wallet.publicKey);
                    if (liveBalance) {
                        wallet.balance = liveBalance.balance;
                    }
                });
                wallets.subWallets.forEach(wallet => {
                    const liveBalance = balances.wallets.find(b => b.publicKey === wallet.publicKey);
                    if (liveBalance) {
                        wallet.balance = liveBalance.balance;
                    }
                });
            }
        } catch (balanceError) {
            console.log('Live balance update unavailable, using cached balances');
        }
        
        displayWallets(wallets);
    } catch (error) {
        console.error('Error refreshing wallets:', error);
    }
}

function displayWallets(wallets) {
    const mainWalletsList = document.getElementById('mainWalletsList');
    const subWalletsList = document.getElementById('subWalletsList');
    const totalBalanceElement = document.getElementById('totalBalance');
    
    if (!mainWalletsList || !subWalletsList) return;
    
    // Clear existing content
    mainWalletsList.innerHTML = '';
    subWalletsList.innerHTML = '';
    
    let totalBalance = 0;

    // Display main wallets
    if (wallets.mainWallets && wallets.mainWallets.length > 0) {
        wallets.mainWallets.forEach(wallet => {
            const walletDiv = document.createElement('div');
            walletDiv.className = 'bg-blue-500/20 p-3 rounded border border-blue-500/30';
            walletDiv.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="font-mono text-sm text-indigo-200">${wallet.publicKey.substring(0, 8)}...${wallet.publicKey.substring(-8)}</span>
                    <span class="font-semibold text-green-400">${(wallet.balance || 0).toFixed(6)} SOL</span>
                </div>
            `;
            mainWalletsList.appendChild(walletDiv);
            totalBalance += wallet.balance || 0;
        });
    } else {
        mainWalletsList.innerHTML = '<div class="text-gray-400 text-center p-4">No main wallets found</div>';
    }

    // Display sub wallets
    if (wallets.subWallets && wallets.subWallets.length > 0) {
        wallets.subWallets.forEach(wallet => {
            const walletDiv = document.createElement('div');
            walletDiv.className = 'bg-gray-500/20 p-3 rounded border border-gray-500/30';
            walletDiv.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="font-mono text-sm text-indigo-200">${wallet.publicKey.substring(0, 8)}...${wallet.publicKey.substring(-8)}</span>
                    <span class="font-semibold text-green-400">${(wallet.balance || 0).toFixed(6)} SOL</span>
                </div>
            `;
            subWalletsList.appendChild(walletDiv);
            totalBalance += wallet.balance || 0;
        });
    } else {
        subWalletsList.innerHTML = '<div class="text-gray-400 text-center p-4">No sub wallets found</div>';
    }

    // Update total balance
    if (totalBalanceElement) {
        totalBalanceElement.textContent = `${totalBalance.toFixed(6)} SOL`;
    }
}

// Backup functions
async function refreshBackups() {
    try {
        const backups = await ipcRenderer.invoke('get-backup-files');
        displayBackups(backups);
    } catch (error) {
        console.error('Error refreshing backups:', error);
    }
}

function displayBackups(backups) {
    const backupsList = document.getElementById('backupsList');
    if (!backupsList) return;
    
    backupsList.innerHTML = '';

    if (!backups || backups.length === 0) {
        backupsList.innerHTML = '<div class="text-gray-400 text-center p-4">No backup files found</div>';
        return;
    }

    backups.forEach(backup => {
        const backupDiv = document.createElement('div');
        backupDiv.className = 'bg-gray-500/20 p-4 rounded border border-gray-500/30';
        backupDiv.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="font-mono text-sm text-indigo-200">${backup.filename}</span>
                <span class="text-xs text-gray-400">${new Date(backup.timestamp).toLocaleString()}</span>
            </div>
            <div class="text-xs text-gray-400 mt-2">
                Main: ${backup.data?.mainWallet ? 1 : 0} | Sub: ${backup.data?.subWallets?.length || 0} wallets
            </div>
        `;
        backupsList.appendChild(backupDiv);
    });
}

// Logging functions
function addLog(message, level = 'info') {
    const activityLog = document.getElementById('activityLog');
    if (!activityLog) return;
    
    const logDiv = document.createElement('div');
    const levelClass = level === 'success' ? 'text-green-400' : 
                      level === 'error' ? 'text-red-400' : 'text-indigo-300';
    
    logDiv.className = `text-sm ${levelClass}`;
    logDiv.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    
    activityLog.insertBefore(logDiv, activityLog.firstChild);
    
    // Keep only last 50 entries
    while (activityLog.children.length > 50) {
        activityLog.removeChild(activityLog.lastChild);
    }
}

function addRecoveryLog(message) {
    const recoveryLog = document.getElementById('recoveryLog');
    if (!recoveryLog) return;
    
    const logEntry = document.createElement('div');
    logEntry.className = 'text-sm text-indigo-300 py-1';
    logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    recoveryLog.appendChild(logEntry);
    recoveryLog.scrollTop = recoveryLog.scrollHeight;
}

// IPC listeners for real-time updates
ipcRenderer.on('log-entry', (event, data) => {
    addLog(data.message, data.level);
});

ipcRenderer.on('stats-update', (event, stats) => {
    if (document.getElementById('cyclesCompleted')) {
        document.getElementById('cyclesCompleted').textContent = stats.cyclesCompleted || 0;
        document.getElementById('totalVolume').textContent = (stats.totalVolume || 0).toFixed(4);
        document.getElementById('successRate').textContent = `${stats.successRate || 0}%`;
        document.getElementById('totalFees').textContent = (stats.totalFees || 0).toFixed(6);
    }
});

// Auto-save config on changes
document.addEventListener('DOMContentLoaded', function() {
    const configFields = ['tokenAddress', 'mainWalletKey', 'subWalletCount', 'buyAmount', 'licenseKey'];
    configFields.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', saveConfig);
        }
    });
    
    // Add license validation on input
    const licenseInput = document.getElementById('licenseKey');
    if (licenseInput) {
        licenseInput.addEventListener('input', function() {
            const licenseKey = this.value;
            if (licenseKey) {
                validateLicenseUI(licenseKey);
            } else {
                document.getElementById('licenseStatus').innerHTML = '';
            }
        });
    }
});

// License validation functions
async function validateLicenseUI(licenseKey) {
    const statusElement = document.getElementById('licenseStatus');
    
    if (!licenseKey) {
        statusElement.innerHTML = '<span class="text-red-400">❌ License key required</span>';
        return false;
    }
    
    try {
        const validation = await ipcRenderer.invoke('validate-license', licenseKey);
        
        if (validation.valid) {
            statusElement.innerHTML = `<span class="text-green-400">✅ Valid until ${validation.expiresAt} (${validation.remainingTime} left)</span>`;
            return true;
        } else {
            statusElement.innerHTML = `<span class="text-red-400">❌ ${validation.error}</span>`;
            return false;
        }
    } catch (error) {
        statusElement.innerHTML = '<span class="text-red-400">❌ Failed to validate license</span>';
        return false;
    }
}
