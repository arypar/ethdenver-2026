# Chaintology

**On-chain intelligence platform for DeFi.** Real-time analytics, automated rule-based trading, and one-click swap execution across Uniswap pools on Ethereum and Monad.

Built for **ETHDenver 2026**.

---

## Bounty Tracks

### Uniswap — Best Use of the Uniswap API

Chaintology deeply integrates the **Uniswap Trading API** as its core swap execution layer. Every swap — whether triggered manually from the Actions inbox or recommended by the Rules Engine — routes through the Uniswap API for quoting, approval checks, and transaction construction.

**How we use it:**

- **Swap Quotes** — `POST /quote` calls to `https://trading-api-labs.interface.gateway.uniswap.org/v1/quote` for real-time pricing with slippage protection.
- **Swap Execution** — `POST /swap` calls to the Uniswap API to build calldata for the Universal Router. The frontend signs and broadcasts the transaction directly from the user's wallet.
- **Approval Management** — Automatic `check-approval` flow that detects whether the user needs a standard ERC-20 approval or a Permit2 signature, and guides them through it before the swap.
- **Pool Resolution** — Token pair metadata, fee tiers, and pool addresses are resolved through Uniswap infrastructure.
- **Rules Engine → Swap Actions** — When a rule fires (e.g. "if ETH/USDC price drops below $2,000"), it generates an action in the inbox. The user can execute the recommended swap in one click, powered entirely by the Uniswap API.
- **Multi-chain Support** — Swap execution works on Ethereum mainnet and Monad (chain ID 143), routing through the appropriate Uniswap deployment.

The Uniswap API key is generated via the [Uniswap Developer Platform](https://developers.uniswap.org/dashboard) and powers all trading functionality.

---

### QuickNode — Best Use of Streams on Monad

Chaintology uses **QuickNode Streams** as the primary data ingestion layer for both Ethereum and Monad. Streams power the entire real-time analytics pipeline — from raw block data to live charts.

**How we use it:**

- **ETH Mainnet Stream** — Decodes Uniswap V3 pool events (`Swap`, `Mint`, `Burn`, `Collect`) from block receipts in real time. Every swap event is parsed, enriched with USD pricing, and stored for charting and rule evaluation.
- **Monad Stream** — Ingests `CurveBuy` and `CurveSell` events from nad.fun contracts on the Monad chain, enabling real-time Monad token analytics.
- **Data Transformation** — Stream webhooks apply on-the-fly decoding of ABI-encoded log data, price calculations (sqrtPriceX96 → human-readable price), and USD conversion before persisting to the database.
- **Real-time Delivery** — Incoming stream data is broadcast over WebSockets to connected clients, powering live-updating charts with zero polling.
- **TVL & Liquidity Tracking** — Mint/Burn/Collect events from Streams feed into TVL calculations and LP position aggregation, giving users a live view of pool liquidity.
- **Backfill Support** — Historical data can be backfilled through Streams, so charts display a full picture from the moment a pool is tracked.
- **Rule Evaluation** — Every streamed swap event is run through the Rules Engine in real time, enabling sub-second automated reactions to on-chain activity.

Streams replace the need for a custom indexer or subgraph. One configuration, continuous delivery, no maintenance.

---

## Features

### Intelligence Dashboard
Real-time, multi-chain analytics for any Uniswap pool or Monad token.

- **Metrics** — Price, Volume, Fees, Swap Count, Liquidity (TVL)
- **Time Ranges** — 1H, 24H, 7D with live streaming updates
- **Chart Types** — Line, Area, Bar — all rendered with Recharts
- **Dual Chain** — Separate tabs for Ethereum and Monad analytics
- **Suggested Pools** — Auto-suggested pools based on streamed activity
- **Live Updates** — WebSocket-driven, no polling

### Rules Engine
A visual, drag-and-drop rule builder for automated on-chain strategies.

- **Conditions** — Price, Notional USD, Price Impact %, Swap Direction, Count in Window, Volume in Window
- **Logic** — AND/OR combinators with nested condition groups
- **Triggers** — Attach rules to any tracked pool; evaluated on every swap
- **Time Windows** — 1m, 5m, 15m, 1h for windowed conditions
- **Multi-chain** — Rules can target ETH or Monad pools
- **Cooldown** — 30-second cooldown prevents duplicate triggers

### Actions Inbox
When rules fire, actions appear in the inbox for review and execution.

- **One-Click Swaps** — Execute the recommended swap directly from the action card, powered by the Uniswap API
- **Status Management** — Pending → Completed / Dismissed
- **Full Context** — Every action shows the triggering condition, pool state, and swap recommendation
- **Browser Notifications** — Get notified even when the tab is in the background

### QuickNode Streams Dashboard
A dedicated view for monitoring streamed blockchain data.

- **Live Transaction Feed** — Real-time stream of decoded on-chain events
- **Liquidity Events** — Mint, Burn, Collect events with position details
- **TVL Calculations** — Live total value locked per pool
- **Simulation Mode** — Generate mock stream data for testing without a live QuickNode connection

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                   │
│  Intelligence Dashboard │ Rules Builder │ Actions Inbox  │
│         Wagmi + RainbowKit │ Recharts │ WebSocket        │
└────────────────────────────┬────────────────────────────┘
                             │ REST + WebSocket
┌────────────────────────────▼────────────────────────────┐
│                    Backend (Express)                      │
│  /uniswap   – Swap quotes, execution, approvals          │
│  /streams   – QuickNode webhook ingestion                 │
│  /api       – Charts, Rules, Actions CRUD                 │
│  /chart-data – Time-series analytics queries              │
│  Rule Engine – Real-time swap evaluation                  │
│  WebSocket   – Live push to frontend                      │
└───────┬──────────────────┬──────────────────┬───────────┘
        │                  │                  │
┌───────▼───────┐  ┌───────▼───────┐  ┌──────▼────────┐
│   Supabase    │  │   Uniswap     │  │   QuickNode   │
│  (PostgreSQL) │  │  Trading API  │  │    Streams    │
│  Swaps, Rules │  │  Quotes/Swaps │  │  ETH + Monad  │
│  Charts, etc  │  │  Approvals    │  │  Block Data   │
└───────────────┘  └───────────────┘  └───────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Radix UI |
| Charts | Recharts |
| Animations | Framer Motion |
| Wallet | Wagmi, Viem, RainbowKit |
| Drag & Drop | @dnd-kit |
| Backend | Express, TypeScript, tsx |
| Database | Supabase (PostgreSQL) |
| Blockchain Data | QuickNode Streams |
| Trading | Uniswap Trading API |
| RPC | Ethereum Mainnet, Monad (Chain ID 143) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [Uniswap API key](https://developers.uniswap.org/dashboard)
- A [QuickNode](https://quicknode.com) account with Streams enabled

### 1. Clone and install

```bash
git clone https://github.com/<your-org>/ethdenver-2026.git
cd ethdenver-2026

# Frontend dependencies
npm install

# Backend dependencies
cd backend && npm install && cd ..
```

### 2. Environment variables

**Frontend** — create `.env.local`:

```env
NEXT_PUBLIC_WC_PROJECT_ID=<walletconnect-project-id>
NEXT_PUBLIC_API_URL=http://localhost:4000
```

**Backend** — create `backend/.env`:

```env
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_KEY=<your-supabase-service-key>
UNISWAP_API_KEY=<your-uniswap-api-key>
QUICKNODE_STREAM_TOKEN=<your-quicknode-stream-token>
ETH_RPC_URL=https://ethereum-rpc.publicnode.com
MONAD_RPC_URL=https://rpc.monad.xyz
PORT=4000
```

### 3. Database setup

Run the SQL migrations in your Supabase SQL editor, in order:

1. `supabase/schema.sql`
2. `supabase/002_dashboard_charts.sql`
3. `supabase/003_rules_and_actions.sql`
4. `supabase/004_quicknode_monad.sql`
5. `supabase/005_streams_and_liquidity.sql`
6. `supabase/006_liquidity_charts.sql`
7. `supabase/007_monad_charts.sql`
8. `supabase/008_dismissed_suggestions.sql`
9. `supabase/009_condition_logic.sql`

### 4. QuickNode Streams

Create two streams in the QuickNode dashboard:

| Stream | Network | Webhook Endpoint |
|--------|---------|-----------------|
| ETH Mainnet | Ethereum | `<your-backend-url>/streams/webhook/eth` |
| Monad | Monad | `<your-backend-url>/streams/webhook/monad` |

Set the authentication header on each stream:
```
x-qn-api-key: <your-quicknode-stream-token>
```

For local development, use ngrok to expose the backend:

```bash
ngrok http 4000
```

### 5. Run

```bash
# Run frontend + backend + ngrok concurrently
npm run dev

# Or run separately
npm run dev:frontend   # http://localhost:3000
npm run dev:backend    # http://localhost:4000
```

---

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main dashboard
│   │   ├── start/page.tsx        # Onboarding flow
│   │   └── quicknode/page.tsx    # Streams dashboard
│   ├── components/
│   │   ├── intelligence/         # Charts, analytics, pool suggestions
│   │   ├── rules/                # Rule builder, conditions, drag-and-drop
│   │   ├── actions/              # Actions inbox, swap execution
│   │   ├── quicknode/            # Stream feed, liquidity panel
│   │   └── shell/                # Top bar, navigation tabs
│   └── lib/
│       ├── store.ts              # React state hooks
│       ├── rule-engine.ts        # Client-side rule evaluation
│       ├── types.ts              # Shared type definitions
│       └── notifications.ts      # Browser notification sync
├── backend/
│   └── src/
│       ├── index.ts              # Express + WebSocket server
│       ├── routes/
│       │   ├── uniswap.ts        # Uniswap Trading API integration
│       │   ├── streams.ts        # QuickNode Streams webhooks
│       │   ├── quicknode.ts       # Monad transaction routes
│       │   ├── rules.ts          # Rules CRUD + evaluation
│       │   ├── charts.ts         # Chart data queries
│       │   └── nadfun.ts         # nad.fun swap quotes
│       └── lib/
│           └── rule-engine.ts    # Server-side rule engine
└── supabase/                     # Database migrations
```

---

## License

MIT
