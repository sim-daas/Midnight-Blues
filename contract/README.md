# Transfer Verification Smart Contract

## Overview

This Compact smart contract implements a **privacy-preserving content access control system** using zero-knowledge proofs. Fans prove they've sent more than a threshold amount of tDust to an artist without revealing the exact amount transferred.

## Architecture

### 1. **TransferVerifier Circuit**

The ZK circuit proves the statement: *"I have sent > X tDust to Artist Y"*

**Public Inputs** (visible on-chain):
- `artistAddress`: The recipient artist's address

**Private Inputs** (kept secret):
- `fanAddress`: The sender's address
- `transferAmount`: The actual amount sent
- `threshold`: The minimum required amount (e.g., 50 tDust)

**Output**:
- `verified`: Boolean indicating if the transfer meets the threshold

**Privacy Guarantee**: The blockchain can verify the proof is valid without ever learning:
- Who sent the transfer (fanAddress is private)
- The exact amount sent (transferAmount is private)
- Only confirms the amount exceeds the threshold

### 2. **SecretContentAccess Contract**

The on-chain contract manages access control and verification.

**State Variables**:
- `thresholds`: Each artist can set their own minimum tDust requirement
- `accessGranted`: Tracks which fans have proven access to which artists

**Key Functions**:

#### `setThreshold(artistAddress, threshold)`
Allows artists to set their required tDust amount for content access.

#### `verifyAndGrantAccess(proof, fanAddress, artistAddress)`
The core verification function:
1. Accepts a ZK proof from the TransferVerifier circuit
2. Verifies the proof is for the correct artist
3. Validates the proof cryptographically
4. Grants access if valid

#### `hasAccess(fanAddress, artistAddress)`
Checks if a fan has been granted access to an artist's content.

## How It Works

### Workflow

```
Fan                    Proof Server              Smart Contract              Backend
|                           |                          |                          |
| 1. Send 51 tDust         |                          |                          |
|------------------------->|                          |                          |
|                           |                          |                          |
| 2. Request proof         |                          |                          |
|------------------------->|                          |                          |
|                           |                          |                          |
|                    3. Generate ZK proof             |                          |
|                    (amount=51, threshold=50)        |                          |
|                           |                          |                          |
| 4. Return proof          |                          |                          |
|<-------------------------|                          |                          |
|                           |                          |                          |
| 5. Submit proof to contract                         |                          |
|---------------------------------------------------->|                          |
|                           |                          |                          |
|                           |                   6. Verify proof                  |
|                           |                   (proof is valid!)                |
|                           |                          |                          |
| 7. Access granted        |                          |                          |
|<----------------------------------------------------|                          |
|                           |                          |                          |
| 8. Request secret content                                                     |
|------------------------------------------------------------------------------>|
|                           |                          |                          |
| 9. Deliver secret track  |                          |                          |
|<------------------------------------------------------------------------------|
```

### Privacy Properties

- **Selective Disclosure**: Only the fact that "amount > threshold" is revealed
- **Data Protection**: Actual transfer amount stays private
- **Anonymity Option**: Fan address can remain private in the circuit
- **Verifiability**: Anyone can verify the proof is valid on-chain

## For Developers

### Testing Locally

Since this is a simplified version for local testing, the actual ZK proof generation is mocked in our backend. In production:

1. The Compact contract would be compiled to a ZK circuit
2. The proof server would generate actual cryptographic proofs
3. The Midnight node would verify proofs on-chain

### Production Considerations

- **Wallet Integration**: Connect to Midnight wallet for real transactions
- **Indexer Queries**: Query actual blockchain state for transfer data
- **Proof Server**: Use real proof server at `http://localhost:6300`
- **Gas Fees**: Account for transaction costs on Midnight network

## Contract Deployment

See `deploy.js` for deployment scripts. For local testing, we're using a simplified flow that focuses on the logic rather than actual blockchain deployment.

## Security Notes

In production, you should add:
- Authentication for `setThreshold()` (only artist can set their own threshold)
- Rate limiting to prevent proof spam
- Event logging for audit trails
- Access expiration timestamps
- Multiple content tiers with different thresholds
