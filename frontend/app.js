// Midnight Lace Frontend - Main Application Logic

const API_BASE_URL = 'http://localhost:3000/api';

// DOM Elements
const accessForm = document.getElementById('accessForm');
const fanAddressInput = document.getElementById('fanAddress');
const artistAddressInput = document.getElementById('artistAddress');
const requestBtn = document.getElementById('requestBtn');
const btnText = requestBtn.querySelector('.btn-text');
const btnLoader = requestBtn.querySelector('.btn-loader');
const statusMessage = document.getElementById('statusMessage');
const accessSection = document.getElementById('accessSection');
const contentSection = document.getElementById('contentSection');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎵 Midnight Lace initialized');

    // Load any saved addresses from localStorage
    const savedFanAddress = localStorage.getItem('fanAddress');
    if (savedFanAddress) {
        fanAddressInput.value = savedFanAddress;
    }

    // Setup form submission
    accessForm.addEventListener('submit', handleAccessRequest);
});

/**
 * Handle access request form submission
 */
async function handleAccessRequest(e) {
    e.preventDefault();

    const fanAddress = fanAddressInput.value.trim();
    const artistAddress = artistAddressInput.value.trim();

    if (!fanAddress || !artistAddress) {
        showStatus('Please enter your wallet address', 'error');
        return;
    }

    // Save fan address to localStorage
    localStorage.setItem('fanAddress', fanAddress);

    // Start loading state
    setLoading(true);
    hideStatus();

    try {
        // Step 1: Check if transfer exists
        console.log('Checking transfer...');
        const transferCheck = await checkTransfer(fanAddress, artistAddress);

        if (!transferCheck.verified) {
            throw new Error(transferCheck.message || 'Transfer does not meet the minimum threshold of 50 tDust');
        }

        showStatus(`✓ Transfer verified: ${transferCheck.transfer.amount} tDust`, 'success');
        await sleep(1000);

        // Step 2: Request ZK proof generation
        console.log('Generating proof...');
        const proofResponse = await requestProof(fanAddress, artistAddress, transferCheck.transfer.amount);

        if (!proofResponse.success) {
            throw new Error(proofResponse.error || 'Failed to generate proof');
        }

        showStatus('✓ Zero-knowledge proof generated successfully', 'success');
        await sleep(1000);

        // Step 3: Unlock content
        console.log('Unlocking content...');
        const contentResponse = await unlockContent(proofResponse.proof, artistAddress);

        if (!contentResponse.success) {
            throw new Error(contentResponse.error || 'Failed to unlock content');
        }

        // Display the unlocked content
        displayUnlockedContent(contentResponse.content, contentResponse.artist, proofResponse.proof);

    } catch (error) {
        console.error('Error:', error);
        showStatus(`❌ ${error.message}`, 'error');
        setLoading(false);
    }
}

/**
 * Check if a transfer exists and meets threshold
 */
async function checkTransfer(fanAddress, artistAddress) {
    const params = new URLSearchParams({ fanAddress, artistAddress });
    const response = await fetch(`${API_BASE_URL}/check-transfer?${params}`);

    if (!response.ok && response.status !== 404) {
        throw new Error('Failed to check transfer');
    }

    return await response.json();
}

/**
 * Request ZK proof generation from proof server
 */
async function requestProof(fanAddress, artistAddress, amount) {
    const response = await fetch(`${API_BASE_URL}/request-proof`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fanAddress, artistAddress, amount })
    });

    return await response.json();
}

/**
 * Unlock content using the generated proof
 */
async function unlockContent(proof, artistAddress) {
    const response = await fetch(`${API_BASE_URL}/unlock-content`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proof, artistAddress })
    });

    return await response.json();
}

/**
 * Display unlocked content to the user
 */
function displayUnlockedContent(content, artist, proof) {
    // Update content details
    document.getElementById('contentTitle').textContent = content.title;
    document.getElementById('contentDescription').textContent = content.description;
    document.getElementById('contentUrl').href = content.url;
    document.getElementById('proofId').textContent = `Proof ID: ${proof.proofId}`;

    // Hide access form and show content with animation
    setLoading(false);
    setTimeout(() => {
        accessSection.classList.add('hidden');
        contentSection.classList.remove('hidden');

        // Scroll to content section
        contentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);

    console.log('✨ Content unlocked successfully!');
}

/**
 * Show status message
 */
function showStatus(message, type = 'success') {
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

/**
 * Set loading state on button
 */
function setLoading(isLoading) {
    if (isLoading) {
        requestBtn.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
    } else {
        requestBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
    }
}

/**
 * Utility: Sleep function
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format address for display (shortened)
 */
function formatAddress(address) {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Debug helper - check backend connectivity
async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        console.log('✅ Backend health check:', data);
        return true;
    } catch (error) {
        console.error('❌ Backend not reachable:', error);
        return false;
    }
}

// Run health check on load
checkBackendHealth();
