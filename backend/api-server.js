import express from 'express';

import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as walletService from './wallet-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Load data files
const mockDataPath = path.join(__dirname, 'mock-data.json');
const musicLibraryPath = path.join(__dirname, 'music-library.json');
const fanBalancesPath = path.join(__dirname, 'fan-balances.json');

let mockData = JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));
let musicLibrary = JSON.parse(fs.readFileSync(musicLibraryPath, 'utf8'));
let fanBalances = JSON.parse(fs.readFileSync(fanBalancesPath, 'utf8'));

// Artist configuration
const ARTIST_ADDRESS = 'mn_addr_undeployed1n2vdcmqfrlyzj7gk54cre3s2euqdnewzeqmekksjqstawc2yu0lsyd58sn';
const INITIAL_FAN_BALANCE = 10000;

// Wallet initialization flag
let walletInitialized = false;

/**
 * Initialize wallet service on startup
 */
async function initializeWallet() {
    try {
        console.log('🔧 Initializing wallet service...');
        await walletService.initGenesisWallet();
        walletInitialized = true;
        console.log('✅ Wallet service ready');
    } catch (error) {
        console.error('❌ Failed to initialize wallet:', error.message);
        console.log('⚠️  API will run in limited mode (no blockchain transactions)');
    }
}

// Initialize wallet on startup (don't block server start)
initializeWallet();

/**
 * Save fan balances to file
 */
function saveFanBalances() {
    fs.writeFileSync(fanBalancesPath, JSON.stringify(fanBalances, null, 2));
}

/**
 * Get or create fan balance
 */
function getFanBalance(fanAddress) {
    if (!fanBalances.fans[fanAddress]) {
        fanBalances.fans[fanAddress] = {
            balance: INITIAL_FAN_BALANCE,
            spent: 0,
            purchases: []
        };
        saveFanBalances();
    }
    return fanBalances.fans[fanAddress];
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Midnight Lace API Server is running',
        walletInitialized,
        services: {
            proofServer: 'http://localhost:6300',
            indexer: 'http://localhost:8088',
            node: 'http://localhost:9944'
        }
    });
});

/**
 * Get available songs
 * GET /api/songs
 */
app.get('/api/songs', (req, res) => {
    res.json({
        songs: musicLibrary.songs,
        artistAddress: ARTIST_ADDRESS
    });
});

/**
 * Get fan balance
 * GET /api/fan/balance/:address
 */
app.get('/api/fan/balance/:address', (req, res) => {
    const { address } = req.params;
    const fanData = getFanBalance(address);

    res.json({
        address,
        balance: fanData.balance,
        spent: fanData.spent,
        purchases: fanData.purchases,
        initialBalance: INITIAL_FAN_BALANCE
    });
});

/**
 * Get genesis wallet balance (for monitoring)
 * GET /api/genesis/balance
 */
app.get('/api/genesis/balance', async (req, res) => {
    if (!walletInitialized) {
        return res.status(503).json({
            error: 'Wallet service not initialized yet'
        });
    }

    try {
        const balance = await walletService.getGenesisBalance();
        res.json({
            unshieldedBalance: balance.unshieldedBalance,
            shieldedBalance: balance.shieldedBalance,
            message: 'Genesis wallet balance (used for demo transactions)'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get genesis balance',
            details: error.message
        });
    }
});

/**
 * Purchase a song - Submit real blockchain transaction!
 * POST /api/purchase-song
 * Body: { fanAddress, songId }
 */
app.post('/api/purchase-song', async (req, res) => {
    const { fanAddress, songId } = req.body;

    if (!fanAddress || !songId) {
        return res.status(400).json({
            error: 'Missing required fields: fanAddress, songId'
        });
    }

    if (!walletInitialized) {
        return res.status(503).json({
            error: 'Wallet service not ready. Please try again in a moment.'
        });
    }

    try {
        // Find the song
        const song = musicLibrary.songs.find(s => s.id === songId);
        if (!song) {
            return res.status(404).json({
                error: 'Song not found'
            });
        }

        // Check fan balance
        const fanData = getFanBalance(fanAddress);
        if (fanData.balance < song.requiredTokens) {
            return res.status(400).json({
                error: 'Insufficient balance',
                required: song.requiredTokens,
                available: fanData.balance
            });
        }

        // Check if already purchased
        if (fanData.purchases.some(p => p.songId === songId)) {
            return res.status(400).json({
                error: 'Song already purchased',
                song: {
                    id: song.id,
                    title: song.title
                }
            });
        }

        console.log(`\n🎵 Processing purchase:`);
        console.log(`   Fan: ${fanAddress}`);
        console.log(`   Song: ${song.title}`);
        console.log(`   Cost: ${song.requiredTokens} tNIGHT`);

        // Submit REAL blockchain transaction!
        const amount = walletService.tNIGHTToBaseUnits(song.requiredTokens);
        const txResult = await walletService.sendTokensToArtist(ARTIST_ADDRESS, amount);

        // Update fan balance (local tracking)
        fanData.balance -= song.requiredTokens;
        fanData.spent += song.requiredTokens;
        fanData.purchases.push({
            songId: song.id,
            title: song.title,
            cost: song.requiredTokens,
            txHash: txResult.txHash,
            timestamp: new Date().toISOString()
        });
        saveFanBalances();

        console.log(`✅ Purchase complete! TX: ${txResult.txHash}`);

        res.json({
            success: true,
            message: 'Song purchased successfully!',
            transaction: {
                txHash: txResult.txHash,
                amount: song.requiredTokens,
                artistAddress: ARTIST_ADDRESS
            },
            song: {
                id: song.id,
                title: song.title,
                url: song.url,
                description: song.description
            },
            fanBalance: {
                remaining: fanData.balance,
                spent: fanData.spent
            }
        });

    } catch (error) {
        console.error('❌ Purchase failed:', error);
        res.status(500).json({
            error: 'Failed to process purchase',
            details: error.message
        });
    }
});

/**
 * Get purchase history for a fan
 * GET /api/fan/purchases/:address
 */
app.get('/api/fan/purchases/:address', (req, res) => {
    const { address } = req.params;
    const fanData = getFanBalance(address);

    res.json({
        purchases: fanData.purchases,
        totalSpent: fanData.spent,
        totalPurchases: fanData.purchases.length
    });
});

/**
 * Get list of all artists (for testing)
 */
app.get('/api/artists', (req, res) => {
    res.json({
        artists: [{
            address: ARTIST_ADDRESS,
            name: 'The Midnight Artist',
            totalSongs: musicLibrary.songs.length
        }]
    });
});

// Legacy endpoints (keeping for backward compatibility)
app.get('/api/check-transfer', (req, res) => {
    const { fanAddress, artistAddress } = req.query;
    const fanData = getFanBalance(fanAddress);

    res.json({
        verified: fanData.spent > 0,
        balance: fanData.balance,
        spent: fanData.spent,
        message: fanData.spent > 0
            ? `Fan has spent ${fanData.spent} tNIGHT`
            : 'No purchases yet'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🌙 Midnight Lace API Server v2.0`);
    console.log(`🚀 Running on http://localhost:${PORT}`);
    console.log(`\n📊 Configuration:`);
    console.log(`   Artist Address: ${ARTIST_ADDRESS.substring(0, 30)}...`);
    console.log(`   Songs Available: ${musicLibrary.songs.length}`);
    console.log(`   Fan Starting Balance: ${INITIAL_FAN_BALANCE} tNIGHT`);
    console.log(`\n🔗 Services:`);
    console.log(`   Proof Server: http://localhost:6300`);
    console.log(`   Indexer: http://localhost:8088`);
    console.log(`   Node: http://localhost:9944`);
    console.log(`\n📝 Available endpoints:`);
    console.log(`   GET  /api/health`);
    console.log(`   GET  /api/songs`);
    console.log(`   GET  /api/fan/balance/:address`);
    console.log(`   GET  /api/fan/purchases/:address`);
    console.log(`   GET  /api/genesis/balance`);
    console.log(`   POST /api/purchase-song`);
    console.log(`   GET  /api/artists`);
    console.log(`\n⏳ Wallet service initializing...`);
});
