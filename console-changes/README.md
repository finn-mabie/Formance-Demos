# Console Changes for Demo Mode

These files need to be added/modified in the Formance Console (platform-ui) to enable demo mode functionality.

## File Locations

Copy these files to your local `platform-ui` checkout:

```
console-changes/
├── app/
│   ├── hooks/
│   │   └── useDemoMode.ts          # → apps/console-v3/app/hooks/
│   ├── components/
│   │   └── demo/
│   │       └── flow-diagram.tsx    # → apps/console-v3/app/components/demo/
│   └── utils/
│       └── ledger-db.server.ts     # → apps/console-v3/app/utils/
```

## What Each File Does

### `useDemoMode.ts`
- Contains all demo configurations (sportsbet, coins-ph, monetae)
- Defines transaction steps with Numscript
- Defines queries to show after each step
- Export `DEMO_CONFIGS` object keyed by ledger metadata `demo` value

### `flow-diagram.tsx`
- SVG-based editable flow diagram component
- Shows money flows between accounts
- Features:
  - Drag nodes to reposition
  - Double-click to edit labels
  - Add/delete boxes and arrows
  - Save layouts to localStorage (per demo/txType)
  - Reset to auto-calculated layout
- Handles @world positioning:
  - Vertical tree for simple flows
  - Horizontal sidecar for exchange patterns (bidirectional swap)

### `ledger-db.server.ts`
- Direct PostgreSQL connection for "Clear Ledger" functionality
- Handles schema discovery (ledger-specific buckets vs _default)
- Delete order respects foreign key constraints
- Requires `LEDGER_DATABASE_URL` environment variable

## Environment Variables

```bash
# For database access (clearing ledgers)
export LEDGER_DATABASE_URL="postgresql://formance:formance@localhost:5432/formance"

# Port forward to access the database
kubectl port-forward -n formance-system svc/postgresql 5432:5432
```

## Adding a New Demo

1. Add your config to `DEMO_CONFIGS` in `useDemoMode.ts`:

```typescript
'my-demo': {
  name: 'My Demo',
  description: 'Description here',
  accounts: [
    { address: '@world', name: 'External', description: '...', color: 'slate' },
    // ... more accounts
  ],
  variables: {
    CUSTOMER_ID: '001',
  },
  transactionSteps: [
    {
      txType: 'STEP_ONE',
      label: 'First Step',
      description: 'What happens',
      numscript: `send [USD/2 10000] (
  source = @world
  destination = @customers:{CUSTOMER_ID}
)

set_tx_meta("type", "STEP_ONE")`,
      queries: [
        {
          title: 'Customer Balance',
          queryType: 'balance',
          addressFilter: 'customers:{CUSTOMER_ID}',
        },
      ],
    },
    // ... more steps
  ],
  usefulQueries: [
    // Queries shown in Explore section
  ],
},
```

2. Create a ledger with metadata `demo: "my-demo"`

3. Access with `?demo=true` URL parameter

## Key Patterns

### Exchange Pattern (FX Conversion)
Use bidirectional swap with @world - no "allowing unbounded overdraft" needed:

```numscript
// 1. Source sends asset to exchange
send [USD/2 500000] (
  source = @customers:001:centralbank
  destination = @exchanges:conv:001
)

// 2. Exchange sends one asset to @world (selling)
send [USD/2 499000] (
  source = @exchanges:conv:001
  destination = @world
)

// 3. @world sends other asset to exchange (buying)
send [USDC/6 4990000000] (
  source = @world
  destination = @exchanges:conv:001
)

// 4. Exchange sends to destination + fee
send [USDC/6 4990000000] (
  source = @exchanges:conv:001
  destination = @customers:001:fireblocks:hot
)

// 5. Store metadata on exchange account
set_account_meta(@exchanges:conv:001, "rate", "0.998")
```

### Account Naming Rules
- Use colons for hierarchy: `@customers:001:fireblocks:hot`
- NO underscores in account names
- Accounts are multi-asset - never include currency in name
- Use per-customer custody accounts, not shared treasury
