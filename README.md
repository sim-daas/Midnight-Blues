# 🌙 Midnight Lace - Privacy-Preserving Content Access

A proof-of-concept demonstrating **zero-knowledge proof-based content unlocking** on the Midnight blockchain. Fans prove they've supported an artist with > 50 tDust without revealing the exact transfer amount.

![Midnight Blockchain](https://img.shields.io/badge/Midnight-Blockchain-6366f1)
![Zero Knowledge](https://img.shields.io/badge/ZK-Proofs-8b5cf6)
![License](https://img.shields.io/badge/license-MIT-green)

## 🎵 The Workflow

1. **Fan sends 51 tDust to Artist** (on Midnight blockchain)
2. **Fan wants to see the "Secret Track"**
3. **Frontend asks Proof Server** to generate a proof: *"I have sent > 50 tDust to Artist X"*
4. **Smart Contract verifies proof** (without revealing actual amount)
5. **Content unlocked!** 🔓

## 🏗️ Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend  │─────▶│  Backend API │─────▶│ Proof Server│
│ (HTML/JS)   │      │  (Express)   │      │ (Port 6300) │
└─────────────┘      └──────────────┘      └─────────────┘
                              │
                              ▼
                     ┌──────────────┐      ┌─────────────┐
                     │   Indexer    │      │    Node     │
                     │ (Port 8088)  │      │ (Port 9944) │
                     └──────────────┘      └─────────────┘
                              │                    │
                              └────────┬───────────┘
                                       ▼
                              ┌──────────────┐
                              │   Contract   │
                              │ (Compact)    │
                              └──────────────┘
```

## 📁 Project Structure

```
midnight-blues/
├── blockchain/
│   └── docker-compose.yml          # Proof server, indexer, node services
├── backend/
│   ├── api-server.js               # Express API server
│   ├── package.json                # Dependencies
│   └── mock-data.json              # Mock transfer data for testing
├── contract/
│   ├── transfer-verifier.cmp       # Compact smart contract
│   ├── deploy.js                   # Contract deployment script
│   ├── deployment-info.json        # Deployment details
│   └── README.md                   # Contract documentation
└── frontend/
    ├── index.html                  # Main UI
    ├── style.css                   # Styling
    └── app.js                      # Application logic
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js (v16+)
- Web browser

### Step 1: Start Docker Services

```bash
cd blockchain
docker compose up -d

# Verify all services are running
docker compose ps
```

Expected output: `proof-server`, `indexer`, and `node` all healthy.

### Step 2: Start Backend API

```bash
cd backend
npm install
node api-server.js
```

API will run on `http://localhost:3000`

### Step 3: Deploy Smart Contract

```bash
cd contract
node deploy.js
```

This validates and "deploys" the Compact contract (mocked for local testing).

### Step 4: Launch Frontend

```bash
cd frontend
python3 -m http.server 8080
```

Open `http://localhost:8080` in your browser.

## 🧪 Testing the System

### Test Case 1: Successful Access (Fan with 51 tDust)

1. Open `http://localhost:8080`
2. Enter fan address: `0x123456789`
3. Artist address is pre-filled: `0xABCDEF`
4. Click "Request Access to Secret Track"
5. ✅ **Expected**: Proof generated → Content unlocked

### Test Case 2: Insufficient Transfer (Fan with 25 tDust)

1. Enter fan address: `0x111222333`
2. Click "Request Access"
3. ❌ **Expected**: Error message - transfer doesn't meet threshold

### Test Case 3: No Transfer Found

1. Enter fan address: `0xNONEXISTENT`
2. Click "Request Access"
3. ❌ **Expected**: Error - no transfer found

## 🔐 Privacy Features

- **Private Transfer Amount**: Actual tDust sent remains hidden
- **Selective Disclosure**: Only proves amount > threshold
- **Zero-Knowledge Proofs**: Cryptographically verified without revealing data
- **On-Chain Verification**: Smart contract validates proofs publicly

## 🛠️ API Endpoints

### Backend API (Port 3000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/check-transfer` | GET | Verify transfer exists |
| `/api/request-proof` | POST | Generate ZK proof |
| `/api/unlock-content` | POST | Unlock content with proof |
| `/api/artists` | GET | List artists |

### Example: Check Transfer

```bash
curl "http://localhost:3000/api/check-transfer?fanAddress=0x123456789&artistAddress=0xABCDEF"
```

### Example: Request Proof

```bash
curl -X POST http://localhost:3000/api/request-proof \
  -H "Content-Type: application/json" \
  -d '{"fanAddress":"0x123456789","artistAddress":"0xABCDEF","amount":51}'
```

## 📝 Mock Data

Located in `backend/mock-data.json`:

- **Fan `0x123456789`** → sent **51 tDust** ✅ (meets threshold)
- **Fan `0x987654321`** → sent **75 tDust** ✅ (meets threshold)
- **Fan `0x111222333`** → sent **25 tDust** ❌ (below threshold)
- **Fan `0xAABBCCDD`** → sent **100 tDust** ✅ (meets threshold)

All transfers are to Artist `0xABCDEF`.

## 🎨 Technology Stack

- **Smart Contract**: Compact (Midnight's ZK-focused language)
- **Backend**: Node.js + Express
- **Frontend**: HTML + CSS + Vanilla JavaScript
- **Blockchain**: Midnight Network (local Docker setup)
- **Privacy**: Zero-Knowledge Proofs via Proof Server

## 📚 Learn More

- **Contract Documentation**: See `contract/README.md` for detailed explanation of ZK circuits
- **Midnight Docs**: https://docs.midnight.network
- **Implementation Plan**: See project artifacts for detailed architecture

## 🐛 Troubleshooting

### Docker services not starting

```bash
cd blockchain
docker compose down
docker compose up -d
```

### Backend API not reachable

Check if port 3000 is available:
```bash
lsof -i :3000
```

### Frontend CORS errors

Ensure backend is running with CORS enabled (already configured in `api-server.js`).

## 🔮 Production Considerations

This is a **local proof-of-concept**. For production:

- [ ] Integrate with actual Midnight wallet (e.g., Lace)
- [ ] Query real blockchain data via indexer
- [ ] Deploy contract to Midnight testnet/mainnet
- [ ] Store content on IPFS or secure CDN
- [ ] Add authentication for artist threshold settings
- [ ] Implement access expiration and content tiers
- [ ] Add comprehensive error handling and logging

## 📄 License

MIT License - feel free to use for learning and experimentation!

## 🙏 Acknowledgments

- Built on [Midnight Blockchain](https://midnight.network)
- Inspired by privacy-preserving content access patterns
- Uses [@bricktowers/midnight-local-network](https://github.com/bricktowers/midnight-local-network)

---

**Made with 🌙 for the Midnight ecosystem**
