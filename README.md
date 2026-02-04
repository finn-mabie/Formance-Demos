# Formance Demo Configurations

Complete setup for running interactive Formance demos with the Formance Console.

## Repository Structure

```
formance-demos/
├── README.md                       # This file
├── demos/
│   ├── rain/
│   │   ├── config.ts              # Rain demo configuration (B2B on-ramp)
│   │   └── setup.sh               # Ledger creation script
│   ├── monetae/
│   │   ├── config.ts              # Demo configuration (TypeScript)
│   │   └── setup.sh               # Ledger creation script
│   └── coins-ph/
│       ├── config.ts              # Demo configuration (TypeScript)
│       └── setup.sh               # Ledger creation script
├── console-changes/               # Files to add to Formance Console
│   ├── README.md                  # Integration instructions
│   └── app/
│       ├── hooks/useDemoMode.ts   # All demo configs + hook
│       ├── components/demo/
│       │   └── flow-diagram.tsx   # SVG flow diagram component
│       └── utils/
│           └── ledger-db.server.ts # Database access for clearing
├── vault-docs/                    # Reference documentation
│   ├── Account Naming Conventions.md
│   ├── Numscript Quick Reference.md
│   ├── Common Flow Patterns.md
│   ├── Demo Mode Guide.md
│   └── Running Demos Locally.md
├── local-setup/                   # Local development scripts
│   ├── README.md
│   └── start-console.sh
└── docs/
    └── account-naming-conventions.md
```

## Available Demos

### Rain
**Money-In: Fiat to Stablecoin On-Ramp (B2B)**

- Partner/customer hierarchy for B2B infrastructure
- Virtual account provisioning with routing/account numbers
- Fiat deposit pending → settled states
- USD → USDC conversion via exchange pattern
- Partner revenue sharing model
- Card spend (USDC → merchant)

### Monetae
**Fiat Custody + Stablecoin Conversion for Wealth Tech**

- ACH deposits with pending states
- Fiat custody at central bank (per-customer accounts)
- USD → USDC conversion via exchange pattern
- USDC → tokenized asset (TSLA) investment
- 1:1 backing verification queries

### Coins.ph
**Cross-Border Remittance with Tracked FX Conversions**

- Per-customer custody tracking (always know whose money)
- USD → USDT conversion at Philippines
- Intercompany transfer with pending settlement
- USDT → BRL conversion at Brazil via OTC
- Wire transfer with pending states
- Platform fee collection (spread + wire fees)

### Sportsbet (in useDemoMode.ts)
**Customer Wallet Lifecycle**

- Deposit → Wager → Win/Lose → Withdraw flow
- Platform float for house bankroll
- Customer fund segregation

## Quick Start

### 1. Set Up Formance Console

```bash
# Clone platform-ui repo
git clone https://github.com/formancehq/platform-ui.git
cd platform-ui

# Copy demo mode files
cp -r /path/to/formance-demos/console-changes/app/* apps/console-v3/app/

# Install dependencies
pnpm install

# Set environment (for local minikube)
export CONSOLE_API_URL=http://localhost:8081
export LEDGER_DATABASE_URL="postgresql://formance:formance@localhost:5432/yhkjzhkjctlk-txpg-ledger"

# Start console
cd apps/console-v3 && npm run dev
```

### 2. Port Forward Services

```bash
# Gateway (for API access)
kubectl port-forward -n yhkjzhkjctlk-txpg svc/gateway 8081:8080

# PostgreSQL (for clearing ledgers)
kubectl port-forward -n formance-system svc/postgresql 5432:5432
```

### 3. Create a Demo Ledger

```bash
cd demos/monetae
chmod +x setup.sh
./setup.sh
```

### 4. Access the Demo

```
http://localhost:3200/yhkjzhkjctlk/txpg/ledgers/monetae-demo?region=local-dev&demo=true
```

## Key Concepts

### Exchange Pattern (FX Conversion)

Use bidirectional swap with @world instead of `allowing unbounded overdraft`:

```numscript
// Source → Exchange
send [USD/2 500000] (
  source = @customers:001:centralbank
  destination = @exchanges:conv:001
)

// Exchange sells USD to @world
send [USD/2 499000] (
  source = @exchanges:conv:001
  destination = @world
)

// Exchange buys USDC from @world
send [USDC/6 4990000000] (
  source = @world
  destination = @exchanges:conv:001
)

// Exchange → Destination
send [USDC/6 4990000000] (
  source = @exchanges:conv:001
  destination = @customers:001:fireblocks:hot
)

// Store rate metadata
set_account_meta(@exchanges:conv:001, "rate", "0.998")
```

### Account Naming Rules

1. **Use colons for hierarchy** - `@customers:001:fireblocks:hot`
2. **No underscores** - Add more segments instead
3. **Multi-asset accounts** - Never include currency in name
4. **Per-customer custody** - Not shared treasury accounts
5. **Colon-separated IDs** - `@customers:001` not `@customers:cust001`

See [vault-docs/Account Naming Conventions.md](./vault-docs/Account%20Naming%20Conventions.md) for complete reference.

### Flow Diagram Visualization

The flow-diagram component automatically positions accounts:
- **Simple flows**: @world at top, funds flow down
- **Exchange flows**: @world as horizontal sidecar with bidirectional arrows

Diagrams are editable (drag nodes, double-click to edit) and saved to localStorage.

## Clearing Demo Data

The console includes a "Clear Ledger" button when `LEDGER_DATABASE_URL` is set.

**Schema detection order:**
1. Ledger name (e.g., `monetae-demo`)
2. Bucket name
3. `_default` schema (fallback)

Ledgers with dedicated buckets use the bucket name as schema.

## Adding a New Demo

1. Create `demos/your-demo/config.ts` with the DemoConfig
2. Create `demos/your-demo/setup.sh` to create the ledger
3. Add the config to `DEMO_CONFIGS` in `useDemoMode.ts`
4. Test with `?demo=true` URL parameter

## Documentation

- [Account Naming Conventions](./vault-docs/Account%20Naming%20Conventions.md)
- [Numscript Quick Reference](./vault-docs/Numscript%20Quick%20Reference.md)
- [Common Flow Patterns](./vault-docs/Common%20Flow%20Patterns.md)
- [Demo Mode Guide](./vault-docs/Demo%20Mode%20Guide.md)
- [Console Changes README](./console-changes/README.md)
