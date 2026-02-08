const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Load mock data
const mockDataPath = path.join(__dirname, 'mock-data.json');
let mockData = JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));

// Proof server configuration
const PROOF_SERVER_URL = 'http://localhost:6300';
const TRANSFER_THRESHOLD = 50;

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Midnight Lace API Server is running',
        services: {
            proofServer: PROOF_SERVER_URL,
            indexer: 'http://localhost:8088',
            node: 'http://localhost:9944'
        }
    });
});

/**
 * Check if a transfer exists and meets the threshold
 * GET /api/check-transfer?fanAddress=xxx&artistAddress=yyy
 */
app.get('/api/check-transfer', (req, res) => {
    const { fanAddress, artistAddress } = req.query;

    if (!fanAddress || !artistAddress) {
        return res.status(400).json({
            error: 'Missing required parameters: fanAddress and artistAddress'
        });
    }

    // Find transfer in mock data
    const transfer = mockData.transfers.find(
        t => t.fanAddress.toLowerCase() === fanAddress.toLowerCase() &&
            t.artistAddress.toLowerCase() === artistAddress.toLowerCase()
    );

    if (!transfer) {
        return res.status(404).json({
            error: 'No transfer found from this fan to the artist',
            verified: false
        });
    }

    const meetsThreshold = transfer.amount > TRANSFER_THRESHOLD;

    res.json({
        verified: meetsThreshold,
        transfer: {
            amount: transfer.amount,
            timestamp: transfer.timestamp,
            txHash: transfer.txHash
        },
        threshold: TRANSFER_THRESHOLD,
        message: meetsThreshold
            ? `Transfer of ${transfer.amount} tDust exceeds threshold of ${TRANSFER_THRESHOLD}`
            : `Transfer of ${transfer.amount} tDust does not meet minimum threshold of ${TRANSFER_THRESHOLD}`
    });
});

/**
 * Request a ZK proof generation (simulated for local testing)
 * POST /api/request-proof
 * Body: { fanAddress, artistAddress, amount }
 */
app.post('/api/request-proof', async (req, res) => {
    const { fanAddress, artistAddress, amount } = req.body;

    if (!fanAddress || !artistAddress || amount === undefined) {
        return res.status(400).json({
            error: 'Missing required fields: fanAddress, artistAddress, amount'
        });
    }

    try {
        // Simulate proof generation
        // In production, this would call the proof server at PROOF_SERVER_URL
        const proofGenerated = amount > TRANSFER_THRESHOLD;

        if (proofGenerated) {
            // Generate a mock ZK proof
            const proof = {
                proofId: `proof_${Date.now()}`,
                statement: `Fan ${fanAddress} sent > ${TRANSFER_THRESHOLD} tDust to Artist ${artistAddress}`,
                verified: true,
                timestamp: new Date().toISOString(),
                // In reality, this would be the actual ZK proof data
                zkProof: Buffer.from(JSON.stringify({
                    witness: 'hidden',
                    publicInputs: [artistAddress],
                    proof: 'mock_proof_data_' + Math.random().toString(36)
                })).toString('base64')
            };

            res.json({
                success: true,
                proof,
                message: 'ZK proof generated successfully'
            });
        } else {
            res.status(403).json({
                success: false,
                error: `Transfer amount (${amount} tDust) does not meet threshold (${TRANSFER_THRESHOLD} tDust)`,
                verified: false
            });
        }
    } catch (error) {
        console.error('Error generating proof:', error);
        res.status(500).json({
            error: 'Failed to generate proof',
            details: error.message
        });
    }
});

/**
 * Get secret content if proof is valid
 * POST /api/unlock-content
 * Body: { proof, artistAddress }
 */
app.post('/api/unlock-content', (req, res) => {
    const { proof, artistAddress } = req.body;

    if (!proof || !artistAddress) {
        return res.status(400).json({
            error: 'Missing required fields: proof, artistAddress'
        });
    }

    // Verify the proof (simplified - just checking if it exists and is verified)
    if (proof.verified) {
        const artist = mockData.artists[artistAddress];

        if (!artist) {
            return res.status(404).json({
                error: 'Artist not found'
            });
        }

        res.json({
            success: true,
            content: artist.secretContent,
            artist: {
                name: artist.name,
                address: artistAddress
            },
            message: 'Content unlocked successfully!'
        });
    } else {
        res.status(403).json({
            success: false,
            error: 'Invalid or unverified proof'
        });
    }
});

/**
 * Get list of all artists (for testing)
 */
app.get('/api/artists', (req, res) => {
    const artistList = Object.keys(mockData.artists).map(address => ({
        address,
        name: mockData.artists[address].name
    }));

    res.json({
        artists: artistList
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🎵 Midnight Lace API Server running on http://localhost:${PORT}`);
    console.log(`📊 Mock data loaded: ${mockData.transfers.length} transfers, ${Object.keys(mockData.artists).length} artists`);
    console.log(`🔒 Proof Server: ${PROOF_SERVER_URL}`);
    console.log(`\n📝 Available endpoints:`);
    console.log(`   GET  /api/health`);
    console.log(`   GET  /api/check-transfer?fanAddress=xxx&artistAddress=yyy`);
    console.log(`   POST /api/request-proof`);
    console.log(`   POST /api/unlock-content`);
    console.log(`   GET  /api/artists`);
});
