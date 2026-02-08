/**
 * Midnight Lace Frontend - Real Blockchain Transactions
 */

const API_BASE = 'http://localhost:3000/api';

// State
let currentFan = null;
let currentBalance = 0;
let songs = [];

// DOM Elements
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginForm = document.getElementById('loginForm');
const fanBalanceAmount = document.getElementById('fanBalanceAmount');
const fanSpent = document.getElementById('fanSpent');
const fanPurchaseCount = document.getElementById('fanPurchaseCount');
const artistAddress = document.getElementById('artistAddress');
const songsGrid = document.getElementById('songsGrid');
const purchaseHistory = document.getElementById('purchaseHistory');
const statusMessage = document.getElementById('statusMessage');

/**
 * Initialize the app
 */
async function init() {
    loginForm.addEventListener('submit', handleLogin);
    await loadSongs();
}

/**
 * Handle fan login
 */
async function handleLogin(e) {
    e.preventDefault();
    const fanAddressInput = document.getElementById('fanAddress');
    const address = fanAddressInput.value.trim();

    if (!address) {
        showStatus('Please enter a wallet address', 'error');
        return;
    }

    currentFan = address;

    try {
        showStatus('Loading your dashboard...', 'info');
        await loadFanBalance();
        await loadPurchaseHistory();

        // Re-render songs after balance is loaded to update button states
        renderSongs();

        // Show dashboard
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');

        showStatus(`Welcome! You have ${currentBalance} tNIGHT`, 'success');
        setTimeout(() => hideStatus(), 3000);

    } catch (error) {
        showStatus(`Error loading dashboard: ${error.message}`, 'error');
    }
}

/**
 * Load available songs
 */
async function loadSongs() {
    try {
        const response = await fetch(`${API_BASE}/songs`);
        const data = await response.json();
        songs = data.songs;
        artistAddress.textContent = data.artistAddress.substring(0, 40) + '...';
        renderSongs();
    } catch (error) {
        console.error('Failed to load songs:', error);
    }
}

/**
 * Load fan balance
 */
async function loadFanBalance() {
    const response = await fetch(`${API_BASE}/fan/balance/${currentFan}`);
    const data = await response.json();

    currentBalance = data.balance;
    fanBalanceAmount.textContent = data.balance.toLocaleString();
    fanSpent.textContent = data.spent.toLocaleString();
    fanPurchaseCount.textContent = data.purchases.length;
}

/**
 * Load purchase history
 */
async function loadPurchaseHistory() {
    const response = await fetch(`${API_BASE}/fan/purchases/${currentFan}`);
    const data = await response.json();

    if (data.purchases.length === 0) {
        purchaseHistory.innerHTML = '<p class="empty-state">No purchases yet. Buy a song to get started!</p>';
        return;
    }

    purchaseHistory.innerHTML = data.purchases.map(p => `
        <div class="history-item">
            <div class="history-icon">🎵</div>
            <div class="history-details">
                <h4>${p.title}</h4>
                <p>Cost: ${p.cost} tNIGHT | ${new Date(p.timestamp).toLocaleString()}</p>
                <p class="tx-hash">TX: ${p.txHash.substring(0, 20)}...</p>
            </div>
            <div class="history-cost">${p.cost} tNIGHT</div>
        </div>
    `).join('');
}

/**
 * Render songs grid
 */
function renderSongs() {
    songsGrid.innerHTML = songs.map(song => {
        const isPurchased = currentFan && isPurchasedSong(song.id);
        const canAfford = currentBalance >= song.requiredTokens;

        return `
            <div class="song-card ${isPurchased ? 'purchased' : ''} ${!canAfford && !isPurchased ? 'locked' : ''}">
                <div class="song-tier">Tier ${song.tier}</div>
                ${isPurchased ? '<div class="purchased-badge">✓ Owned</div>' : ''}
                
                <div class="song-icon">🎵</div>
                <h3 class="song-title">${song.title}</h3>
                <p class="song-artist">${song.artist}</p>
                <p class="song-description">${song.description}</p>
                
                <div class="song-meta">
                    <span>🎼 ${song.genre}</span>
                    <span>⏱️ ${song.duration}</span>
                </div>
                
                <div class="song-price">${song.requiredTokens} tNIGHT</div>
                
                ${isPurchased
                ? '<button class="btn-secondary" disabled>Already Purchased</button>'
                : canAfford
                    ? `<button class="btn-primary" onclick="purchaseSong('${song.id}')">🛒 Purchase</button>`
                    : '<button class="btn-secondary" disabled>Insufficient Balance</button>'
            }
            </div>
        `;
    }).join('');
}

/**
 * Check if song is purchased
 */
function isPurchasedSong(songId) {
    // This will be checked from purchase history
    const historyItems = purchaseHistory.querySelectorAll('.history-item');
    return Array.from(historyItems).some(item =>
        item.querySelector('h4').textContent === songs.find(s => s.id === songId)?.title
    );
}

/**
 * Purchase a song - REAL BLOCKCHAIN TRANSACTION!
 */
window.purchaseSong = async function (songId) {
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    if (currentBalance < song.requiredTokens) {
        showStatus('Insufficient balance!', 'error');
        return;
    }

    if (!confirm(`Purchase "${song.title}" for ${song.requiredTokens} tNIGHT?\\n\\nThis will submit a REAL transaction to the blockchain!`)) {
        return;
    }

    showStatus(`Processing purchase... Submitting blockchain transaction...`, 'info');

    try {
        const response = await fetch(`${API_BASE}/purchase-song`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fanAddress: currentFan,
                songId: song.id
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Purchase failed');
        }

        // Success!
        showStatus(`✅ Purchase successful! TX: ${data.transaction.txHash.substring(0, 20)}...`, 'success');

        // Update UI
        await loadFanBalance();
        await loadPurchaseHistory();
        renderSongs();

        // Show transaction details
        setTimeout(() => {
            alert(
                `🎉 Song Unlocked!\\n\\n` +
                `Song: ${song.title}\\n` +
                `Cost: ${song.requiredTokens} tNIGHT\\n` +
                `TX Hash: ${data.transaction.txHash}\\n\\n` +
                `The artist's wallet has received ${song.requiredTokens} tNIGHT on-chain!\\n` +
                `Check their Lace wallet to see the balance increase.`
            );
        }, 1000);

    } catch (error) {
        showStatus(`❌ Purchase failed: ${error.message}`, 'error');
        console.error('Purchase error:', error);
    }
};

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.classList.remove('hidden');
}

/**
 * Hide status message
 */
function hideStatus() {
    statusMessage.classList.add('hidden');
}

// Initialize on load
init();
