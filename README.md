<p align="center">
  <img src="logo.svg" alt="DropPilot" width="120" />
</p>

<h1 align="center">DropPilot</h1>

<p align="center"><strong>Autonomous AI agent for drop commerce on Initia.</strong></p>

<p align="center">
DropPilot lets users delegate drop purchases to an on-chain authorized agent that monitors, evaluates, and auto-buys drops — so you never miss a mint.
</p>

> **Live Demo:** [https://drop-pilot-ten.vercel.app](https://drop-pilot-ten.vercel.app)  
> **Agent API:** [https://droppilot.onrender.com/health](https://droppilot.onrender.com/health)  
> **Chain:** Initia Testnet (`initiation-2`)

---

## Vision

Automate commerce trustlessly. Users set budgets; an AI agent buys drops on their behalf — with spending limits enforced on-chain by the Move VM. No overspending, instant revocation, full transparency. A new model for safe autonomous commerce.

---

## Problem

Drop minting on-chain is time-sensitive. Users miss drops because they're asleep, in a different timezone, or simply didn't see the announcement. Existing solutions require constant manual monitoring.

## Solution

DropPilot introduces an **autonomous agent** that:

1. **Monitors** all active drops on-chain in real-time (3-second polling)
2. **Evaluates** eligibility — checks budget, supply, user limits, and time windows
3. **Executes** purchases on behalf of authorized users using delegated on-chain authority
4. **Reports** via an interactive chat interface with real-time status

The agent operates within strict on-chain budget constraints set by each user — it can never spend more than authorized.

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend   │────▶│   Agent Service  │────▶│  Initia Chain   │
│  React/Vite  │     │    Node.js       │     │  Move Contract  │
│   Vercel     │     │    Render        │     │  initia_drops   │
└─────────────┘     └──────────────────┘     └─────────────────┘
       │                     │                        │
       │    Wallet signing   │   agent_purchase()     │
       └─────────────────────┼────────────────────────┘
                             │
                     On-chain authorization
                     (budget-capped delegation)
```

### Smart Contract (`contracts/sources/drops.move`)

Written in Move, deployed on Initia L1 testnet. Manages:

| Function | Description |
|----------|-------------|
| `create_drop` | Create timed, priced drops with supply caps |
| `purchase` | Direct user purchase |
| `authorize_agent` | Delegate budget-capped spending to agent wallet |
| `agent_purchase` | Agent buys on user's behalf (on-chain auth check) |
| `create_listing` / `buy_listing` | Secondary marketplace |
| `revoke_agent` | Revoke agent authorization anytime |

All authorization is enforced **on-chain** — the agent cannot spend beyond the user's set budget.

### Agent Service (`agent/src/agent.js`)

Node.js service that:
- Polls drops every 3 seconds with parallel fetching
- Skips ended/cancelled/sold-out drops (cached)
- Executes `agent_purchase` for registered users
- Persists registrations to disk (survives restarts)
- Exposes chat API for natural-language interaction

### Frontend (`frontend/`)

React 19 + Vite + TailwindCSS with:
- **Drops** — Browse, filter, and purchase live drops
- **Create** — Launch new drops with pricing and time windows
- **Agent** — Authorize agent, set budget, chat with agent, monitor watched drops
- **My Items** — View owned items, list on secondary market
- **Marketplace** — Browse and buy secondary listings

All data is queried from chain — zero mock data.

---

## Key Features

- **On-chain agent delegation** — Users authorize the agent with a specific budget via `authorize_agent`. The Move contract enforces spending limits.
- **Real-time auto-buy** — 3-second poll interval with parallel drop scanning and smart skip cache.
- **Agent chat** — Natural language interface to check status, watch/unwatch drops, trigger buys, and query balances.
- **Secondary market** — Users can list purchased items for resale. Agent can buy listings too.
- **Budget safety** — Agent cannot exceed the user's on-chain authorized budget. Users can revoke anytime.
- **Beyond Web3** — The autonomous agent model applies to any time-sensitive commerce (sneaker drops, concert tickets, flash sales). The difference is that blockchain enforcement removes the need to trust a centralized service with your money.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Initia L1 (Move VM) |
| Smart Contract | Move (Aptos-style) |
| Frontend | React 19, Vite, TailwindCSS, Framer Motion |
| Wallet | InterwovenKit (Initia wallet adapter) |
| Agent | Node.js, @initia/initia.js |
| Hosting | Vercel (frontend), Render (agent) |

---

## Deployed Addresses

| Resource | Address |
|----------|---------|
| Module | `init1vhaytr72cd8se33xnleua8m8wxncgmdjtnvlhf` |
| Agent Wallet | `init1sutlyucfyx76dya790w7hung64d6zlyqc267hm` |
| Chain | `initiation-2` (Initia Testnet) |
| LCD | `https://rest.testnet.initia.xyz` |
| RPC | `https://rpc.testnet.initia.xyz` |

---

## Run Locally

### Prerequisites

- Node.js ≥ 18
- An Initia testnet wallet with INIT tokens

### Smart Contract

```bash
cd contracts
# Deploy using initiad CLI
initiad tx move publish \
  --from deployer \
  --gas auto --gas-adjustment 1.5 --gas-prices 0.015uinit \
  --chain-id initiation-2 \
  --node https://rpc.testnet.initia.xyz:443
```

### Agent

```bash
cd agent
cp .env.example .env
# Fill in AGENT_MNEMONIC and endpoints
npm install
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Fill in module address and endpoints
npm install
npm run dev
```

---

## How It Works (User Flow)

1. **Connect wallet** on the frontend
2. **Browse drops** on the Drops page
3. **Go to Agent tab** → Set a budget (e.g., 5 INIT) → Click "Authorize Agent"
4. **Watch drops** you're interested in
5. **Agent auto-buys** when a watched drop goes live and you have budget
6. **Check My Items** to see purchased items
7. **List on Marketplace** to resell if desired
8. **Chat with agent** anytime: "status", "watching", "buy drop 1", etc.

---

## Contract Security

- Agent authorization is **on-chain** — the contract checks `AgentWallet.active` and `budget - spent` before every purchase
- Users can **revoke** agent access at any time via `revoke_agent`
- Agent **cannot** create drops, cancel drops, or modify listings — only purchase within authorized budgets
- All error codes are explicit (13 defined error constants)

---

## Funding Model & Roadmap

**Current model (testnet):** Users fund a shared agent wallet. The agent pays for purchases from this pool. Per-user budgets are enforced on-chain — the agent cannot exceed any user's authorized amount — but the wallet balance itself is pooled.

**What this means:** If two users each deposit 5 INIT, the agent has 10 INIT total. It can only spend up to each user's budget cap, but the underlying funds are not isolated per user.

**Production roadmap:**
- **Per-user escrow** — Move contract holds each user's funds separately. The agent can only draw from a user's own escrow balance, not the shared pool.
- **Deposit ledger** — On-chain tracking of how much each user deposited, with a withdraw function to reclaim unused funds.
- **Auto-refund on revoke** — When a user revokes agent access, their unspent deposit is returned automatically.

This is a known simplification for the hackathon. The budget-cap enforcement is fully on-chain today; fund isolation is the next step.

---

## Team

| Name | Role | GitHub |
|------|------|--------|
| Kodark | Solo Builder | [@Kodark220](https://github.com/Kodark220) |

Built for the Initia Hackathon on DoraHacks.

---

## License

MIT
