# Configuration Guide - Using Your Real Lace Wallet

This guide shows you how to configure the Midnight Lace application to use your **real Lace wallet address** as the artist address for local testing.

## Why This Works for Local Testing

Since everything runs locally with **mock data**, you can:
- ✅ Use your real Lace wallet address as the "artist"
- ✅ Let users enter any random address as the "fan"
- ✅ The system checks against mock data in `backend/mock-data.json`
- ✅ No real blockchain transactions happen (it's all simulated)

## Step-by-Step Configuration

### 1. Get Your Real Lace Wallet Address

Open your Lace wallet and copy your Midnight wallet address. It should look something like:
```
addr1qx...your_address_here...xyz
```

For this example, let's say your address is: `addr1qxABCDEF123456`

### 2. Update the Frontend (Optional)

If you want the artist address to be **pre-filled** with your wallet:

**File**: `frontend/index.html`

Find this line (around line 45):
```html
<input 
    type="text" 
    id="artistAddress" 
    name="artistAddress"
    value="0xABCDEF"
    readonly
>
```

Change the `value` to your real address:
```html
<input 
    type="text" 
    id="artistAddress" 
    name="artistAddress"
    value="addr1qxABCDEF123456"
    readonly
>
```

Or make it editable by removing `readonly`:
```html
<input 
    type="text" 
    id="artistAddress" 
    name="artistAddress"
    value="addr1qxABCDEF123456"
    placeholder="Artist wallet address"
>
```

### 3. Update Mock Data with Your Address

**File**: `backend/mock-data.json`

Replace the artist address in the mock data:

```json
{
  "transfers": [
    {
      "fanAddress": "0x123456789",
      "artistAddress": "addr1qxABCDEF123456",  // ← Your real address
      "amount": 51,
      "timestamp": "2026-02-08T10:30:00Z",
      "txHash": "0xabcd1234567890"
    },
    {
      "fanAddress": "0x987654321",
      "artistAddress": "addr1qxABCDEF123456",  // ← Your real address
      "amount": 75,
      "timestamp": "2026-02-08T11:15:00Z",
      "txHash": "0xefgh0987654321"
    }
  ],
  "artists": {
    "addr1qxABCDEF123456": {  // ← Your real address as key
      "name": "Your Artist Name",
      "secretContent": {
        "title": "Secret Track: Your Exclusive Song",
        "url": "https://example.com/your-secret-track.mp3",
        "description": "Your exclusive content description"
      }
    }
  }
}
```

### 4. Update Contract Deployment (Optional)

**File**: `contract/deploy.js`

If you want to set your address in the deployment config:

Find this line (around line 14):
```javascript
artistAddress: '0xABCDEF'
```

Change to:
```javascript
artistAddress: 'addr1qxABCDEF123456'  // Your real address
```

### 5. Restart Backend Server

After making changes to `mock-data.json`, restart the backend:

```bash
# Stop the current server (Ctrl+C in the terminal)
# Then restart:
cd backend
node api-server.js
```

## Testing Scenarios

### Scenario 1: Fan with Enough tDust (Successful)

**Fan enters**:
- Fan Address: `0x123456789` (or any random address you added to mock data)
- Artist Address: `addr1qxABCDEF123456` (your real wallet)

**Result**: ✅ Proof generated, content unlocked

### Scenario 2: New Fan Address (Not in Mock Data)

**Fan enters**:
- Fan Address: `0xNEWUSER12345` (not in mock-data.json)
- Artist Address: `addr1qxABCDEF123456`

**Result**: ❌ Error - "No transfer found"

### Scenario 3: Fan with Insufficient tDust

Add a new entry with low amount:
```json
{
  "fanAddress": "0xPOORFAN",
  "artistAddress": "addr1qxABCDEF123456",
  "amount": 25,  // Below 50 threshold
  "timestamp": "2026-02-08T12:00:00Z",
  "txHash": "0x1234567890abcdef"
}
```

**Result**: ❌ Error - "Does not meet minimum threshold"

## Adding Multiple Fans for Testing

You can easily add multiple test fan addresses to simulate different users:

```json
{
  "transfers": [
    {
      "fanAddress": "fan_wallet_1",
      "artistAddress": "YOUR_REAL_WALLET",
      "amount": 100,
      "timestamp": "2026-02-08T10:00:00Z",
      "txHash": "0xhash1"
    },
    {
      "fanAddress": "fan_wallet_2",
      "artistAddress": "YOUR_REAL_WALLET",
      "amount": 60,
      "timestamp": "2026-02-08T11:00:00Z",
      "txHash": "0xhash2"
    },
    {
      "fanAddress": "fan_wallet_3",
      "artistAddress": "YOUR_REAL_WALLET",
      "amount": 30,  // Won't work - below threshold
      "timestamp": "2026-02-08T12:00:00Z",
      "txHash": "0xhash3"
    }
  ],
  "artists": {
    "YOUR_REAL_WALLET": {
      "name": "Your Artist Name",
      "secretContent": {
        "title": "Exclusive Track",
        "url": "https://your-content-url.com/track.mp3",
        "description": "Special content for supporters"
      }
    }
  }
}
```

## Privacy Note

Since this is **local mock data**:
- ✅ Your real wallet address is only stored locally
- ✅ No blockchain transactions occur
- ✅ No private keys are exposed
- ✅ Safe for testing without risk

When you move to production with real Midnight blockchain:
- Real transfers would be queried from the indexer
- Real proofs would be generated by the proof server
- Real smart contract verification would happen on-chain

## Quick Reference Commands

### View current mock data:
```bash
cat backend/mock-data.json
```

### Restart backend after changes:
```bash
cd backend
node api-server.js
```

### Test API with your address:
```bash
curl "http://localhost:3000/api/check-transfer?fanAddress=0x123456789&artistAddress=YOUR_REAL_WALLET"
```

## Next Steps

Once configured with your real wallet:
1. Share the frontend URL with friends/testers
2. Give them random fan addresses to use (from your mock data)
3. They can test the ZK proof workflow
4. All transfers are simulated locally - completely safe!

---

**Remember**: This is a local proof-of-concept. Real production deployment would connect to the actual Midnight blockchain and wouldn't use mock data.
