/**
 * Midnight Wallet Service
 * Handles real blockchain transaction submission using Midnight Wallet SDK
 */

const ledger = require('@midnight-ntwrk/ledger-v7');
const { DustWallet } = require('@midnight-ntwrk/wallet-sdk-dust-wallet');
const { WalletFacade } = require('@midnight-ntwrk/wallet-sdk-facade');
const { HDWallet, Roles } = require('@midnight-ntwrk/wallet-sdk-hd');
const { ShieldedWallet } = require('@midnight-ntwrk/wallet-sdk-shielded');
const {
    createKeystore,
    InMemoryTransactionHistoryStorage,
    PublicKey: UnshieldedPublicKey,
    UnshieldedWallet,
} = require('@midnight-ntwrk/wallet-sdk-unshielded-wallet');
const { MidnightBech32m } = require('@midnight-ntwrk/wallet-sdk-address-format');
const rx = require('rxjs');

// Configuration
const INDEXER_PORT = Number.parseInt(process.env['INDEXER_PORT'] || '8088', 10);
const NODE_PORT = Number.parseInt(process.env['NODE_PORT'] || '9944', 10);
const PROOF_SERVER_PORT = Number.parseInt(process.env['PROOF_SERVER_PORT'] || '6300', 10);

const INDEXER_HTTP_URL = `http://localhost:${INDEXER_PORT}/api/v3/graphql`;
const INDEXER_WS_URL = `ws://localhost:${INDEXER_PORT}/api/v3/graphql/ws`;

const configuration = {
    networkId: 'undeployed',
    costParameters: {
        additionalFeeOverhead: 300_000_000_000_000_000n,
        feeBlocksMargin: 5,
    },
    relayURL: new URL(`ws://localhost:${NODE_PORT}`),
    provingServerUrl: new URL(`http://localhost:${PROOF_SERVER_PORT}`),
    indexerClientConnection: {
        indexerHttpUrl: INDEXER_HTTP_URL,
        indexerWsUrl: INDEXER_WS_URL,
    },
    indexerUrl: INDEXER_WS_URL,
};

// Genesis wallet seed (same as midnight-local-network funding script)
const GENESIS_SEED = Buffer.from(
    '0000000000000000000000000000000000000000000000000000000000000001',
    'hex'
);

let genesisWallet = null;
let genesisWalletInfo = null;

/**
 * Initialize wallet with seed
 */
async function initWalletWithSeed(seed) {
    const hdWallet = HDWallet.fromSeed(Uint8Array.from(seed));

    if (hdWallet.type !== 'seedOk') {
        throw new Error('Failed to initialize HDWallet');
    }

    const derivationResult = hdWallet.hdWallet
        .selectAccount(0)
        .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
        .deriveKeysAt(0);

    if (derivationResult.type !== 'keysDerived') {
        throw new Error('Failed to derive keys');
    }

    hdWallet.hdWallet.clear();

    const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(derivationResult.keys[Roles.Zswap]);
    const dustSecretKey = ledger.DustSecretKey.fromSeed(derivationResult.keys[Roles.Dust]);
    const unshieldedKeystore = createKeystore(derivationResult.keys[Roles.NightExternal], configuration.networkId);

    const shieldedWallet = ShieldedWallet(configuration).startWithSecretKeys(shieldedSecretKeys);
    const dustWallet = DustWallet(configuration).startWithSecretKey(
        dustSecretKey,
        ledger.LedgerParameters.initialParameters().dust,
    );
    const unshieldedWallet = UnshieldedWallet({
        ...configuration,
        txHistoryStorage: new InMemoryTransactionHistoryStorage(),
    }).startWithPublicKey(UnshieldedPublicKey.fromKeyStore(unshieldedKeystore));

    const facade = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
    await facade.start(shieldedSecretKeys, dustSecretKey);

    return { wallet: facade, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

/**
 * Initialize genesis wallet (used to send transactions on behalf of demo fans)
 */
async function initGenesisWallet() {
    if (genesisWallet) {
        return genesisWalletInfo;
    }

    console.log('🔑 Initializing genesis wallet...');
    const walletInfo = await initWalletWithSeed(GENESIS_SEED);
    genesisWallet = walletInfo.wallet;

    // Wait for wallet to sync
    console.log('⏳ Waiting for genesis wallet to sync...');
    await rx.firstValueFrom(genesisWallet.state().pipe(rx.filter((s) => s.isSynced)));

    const shieldedAddress = await rx.firstValueFrom(
        genesisWallet.state().pipe(
            rx.filter((s) => s.isSynced),
            rx.map((s) => MidnightBech32m.encode('undeployed', s.shielded.address).toString()),
        ),
    );

    const unshieldedAddress = walletInfo.unshieldedKeystore.getBech32Address().toString();

    genesisWalletInfo = {
        ...walletInfo,
        shieldedAddress,
        unshieldedAddress
    };

    console.log('✅ Genesis wallet initialized');
    console.log(`   Shielded: ${shieldedAddress}`);
    console.log(`   Unshielded: ${unshieldedAddress}`);

    return genesisWalletInfo;
}

/**
 * Send unshielded tokens from genesis wallet to an artist
 * @param {string} artistAddress - Unshielded address of artist (mn_addr_undeployed...)
 * @param {bigint} amount - Amount in base units (1 tNIGHT = 1e12 base units)
 * @returns {Promise<{txHash: string, amount: bigint}>}
 */
async function sendTokensToArtist(artistAddress, amount) {
    try {
        console.log(`💸 Sending ${amount} base units to ${artistAddress}...`);

        const walletInfo = await initGenesisWallet();
        const { wallet, unshieldedKeystore } = walletInfo;

        // Create transfer transaction
        const outputs = [
            {
                type: 'unshielded',
                outputs: [
                    {
                        amount: amount,
                        receiverAddress: artistAddress,
                        type: ledger.unshieldedToken().raw,
                    },
                ],
            }
        ];

        const recipe = await wallet.transferTransaction(
            outputs,
            {
                shieldedSecretKeys: walletInfo.shieldedSecretKeys,
                dustSecretKey: walletInfo.dustSecretKey,
            },
            {
                ttl: new Date(Date.now() + 30 * 60 * 1000),
                payFees: true,
            },
        );

        // Sign transaction
        const signedTx = await wallet.signUnprovenTransaction(
            recipe.transaction,
            (payload) => unshieldedKeystore.signData(payload),
        );

        // Finalize and submit
        const finalizedTx = await wallet.finalizeTransaction(signedTx);
        const txHash = await wallet.submitTransaction(finalizedTx);

        console.log(`✅ Transaction submitted: ${txHash}`);

        return {
            txHash,
            amount
        };
    } catch (error) {
        console.error('❌ Error sending transaction:', error);
        throw error;
    }
}

/**
 * Convert tNIGHT (human-readable) to base units
 * 1 tNIGHT = 1e12 base units
 */
function tNIGHTToBaseUnits(tnight) {
    return BigInt(tnight) * BigInt(1_000_000_000_000);
}

/**
 * Convert base units to tNIGHT (human-readable)
 */
function baseUnitsToTNIGHT(baseUnits) {
    return Number(BigInt(baseUnits) / BigInt(1_000_000_000_000));
}

/**
 * Get genesis wallet balance (for monitoring)
 */
async function getGenesisBalance() {
    const walletInfo = await initGenesisWallet();
    const state = await rx.firstValueFrom(walletInfo.wallet.state());

    return {
        unshieldedBalance: baseUnitsToTNIGHT(state.unshielded.balance.total),
        shieldedBalance: baseUnitsToTNIGHT(state.shielded.balance.total)
    };
}

module.exports = {
    initGenesisWallet,
    sendTokensToArtist,
    tNIGHTToBaseUnits,
    baseUnitsToTNIGHT,
    getGenesisBalance
};
