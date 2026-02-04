# Demo Mode Guide

A fullscreen interactive feature for the Formance Console that provides guided walkthroughs for client presentations.

---

## Quick Start

1. **Create a ledger** with `demo` metadata specifying the demo type
2. **Navigate to the ledger** in the console
3. **Add `?demo=true`** to the URL
4. **Walk through the demo** - execute transactions, see balance impacts, explore the data

Example URL:
```
http://localhost:3200/org/stack/ledgers/sportsbet-demo?region=local-dev&demo=true
```

---

## How It Works

Demo Mode reads the `demo` key from the ledger's metadata to load the corresponding demo configuration. The configuration defines:
- Account structure
- Transaction steps with Numscript
- Variables (customer IDs, amounts, etc.)
- Useful API queries to explore

### Creating a Demo Ledger

**Important:** Always create demo ledgers in their own bucket for easier data management and clearing.

```bash
# Create ledger in its own bucket (recommended for demos)
curl -X POST "$API_URL/api/ledger/v2/sportsbet-demo" \
  -H "Content-Type: application/json" \
  -d '{"bucket": "sportsbet-demo", "metadata": {"demo": "sportsbet"}}'

# Example for coins-ph demo
curl -X POST "$API_URL/api/ledger/v2/coins-ph-demo" \
  -H "Content-Type: application/json" \
  -d '{"bucket": "coins-ph-demo", "metadata": {"demo": "coins-ph"}}'
```

The `demo` value must match a configured demo type in the codebase.

**Why use separate buckets?**
- Easier to clear data (can delete entire bucket)
- Isolates demo data from production ledgers
- Cleaner schema organization in PostgreSQL

---

## Demo UI Features

### 1. Overview Screen

Shows the account structure and transaction flow before starting:
- **Account cards** - Each account with its purpose (e.g., "Available Balance", "Pending Wagers")
- **Variables** - Customer ID, wager amounts, etc. that will be used
- **Transaction preview** - List of all steps in the flow

### 2. Transaction Steps

Each step shows:
- **Transaction Flow Diagram** - Visual representation of the fund flow (accounts as boxes, amounts as labels on arrows)
- **Metadata Hints** - Shows what data will be stored on transactions and accounts
- **Numscript code** - The actual transaction script (toggle to show/hide)
- **API call details** - The HTTP request that will be made
- **Run Step button** - Execute the transaction directly
- **Executed Transaction** - After running, shows the actual posting with source → destination
- **Balance Impact** - Shows how account balances changed
- **Metadata** - Business context (customer_id, wager_id, etc.)
- **Explore the Data** - Collapsible query cards to answer questions about the ledger

### Transaction Flow Diagram

Before running each transaction, a visual diagram shows the expected fund flow:

**Design Principles:**
- **Account boxes** - Formance accounts shown as bordered boxes with `@` prefix (e.g., `@treasury:binance:hot`)
- **Amounts as text** - Transaction amounts shown as plain text labels on arrows (NOT in boxes - boxes are only for accounts)
- **Arrows** - Show direction of fund movement
- **Metadata hints** - Off to the side, show what will be stored on transactions and accounts

**Two Layout Modes:**

1. **Vertical/Intermediary Flow** - Used when destination of one posting equals source of the next (e.g., exchange accounts)
   ```
   @treasury:binance:hot
          │
       10,000 USDT
          ↓
   @exchanges:usdt:brl:001
          │
       R$54,500
          ↓
   @banks:bradesco:operating
   ```

2. **Horizontal Flow** - Used for standard postings
   ```
   @source ──── $100 ───→ @destination
   ```

**Implementation:**
- Component: `/app/components/demo/transaction-flow-diagram.tsx`
- Automatically parses Numscript to extract postings
- Detects intermediary flow pattern automatically
- Extracts metadata keys from `set_tx_meta()` and `set_account_meta()` calls

**Sizing for Screen Sharing:**
- Account boxes: `text-base` with `px-5 py-4` padding
- Amounts: `text-base font-semibold` (no border/background)
- Description: `text-lg`
- Metadata hints: `text-base`
- Arrows: `h-6 w-6`

### Account Balances Sidebar

A collapsible sidebar on the right shows all accounts in the ledger with their current balances. This updates automatically after each transaction, giving a real-time view of the entire ledger state.

### Query Interaction Pattern

Queries in the demo use a collapsible card pattern:

1. **Click to expand** - Shows the API endpoint and request body
2. **Click "Run Query"** - Fetches the actual data from the API
3. **View results** - Balances, transactions, or accounts displayed

This allows the presenter to:
- Show the API structure without actually calling it
- Control when data is fetched
- Demonstrate the query syntax to the audience

### Step-Specific Queries

Each transaction step can have its own queries that appear after execution. These show the API endpoint and request body, making it easy to demonstrate how to query the ledger:

```typescript
{
  txType: 'WAGER_PLACED',
  label: 'Place Wager',
  numscript: `...`,
  queries: [
    {
      title: 'Locked in Wager',
      description: 'Funds locked while bet is active',
      queryType: 'balance',
      addressFilter: 'customers:{CUSTOMER_ID}:pending:wager',
    },
    {
      title: 'Total Customer Funds',
      description: 'Sum across all customer accounts',
      queryType: 'balance',
      addressFilters: [  // Multiple addresses = $or query
        'customers:{CUSTOMER_ID}:available',
        'customers:{CUSTOMER_ID}:pending:wager',
      ],
    },
    {
      title: 'Transaction History',
      description: 'All customer transactions',
      queryType: 'transactions',
      transactionFilter: {
        account: 'customers:{CUSTOMER_ID}:',
      },
    },
  ],
}
```

### 3. Explore Section

After completing transactions, explore the data:
- **Balance queries** - Check individual or aggregated balances
- **$or filter queries** - Combine multiple accounts in one call
- **Transaction history** - Filter by account or metadata
- **Account listings** - See all accounts matching patterns
- **API details** - Shown by default so you can copy to Postman

---

## Adding a New Demo Configuration

Edit `/apps/console-v3/app/hooks/useDemoMode.ts`:

```typescript
const DEMO_CONFIGS: Record<string, DemoConfig> = {
  'my-demo': {
    name: 'My Demo Flow',
    description: 'What this demo demonstrates',

    // Define the accounts used in this demo
    accounts: [
      {
        address: '@world',
        name: 'External World',
        description: 'Money entering/leaving the system',
        color: 'slate',
      },
      {
        address: '@users:{USER_ID}:wallet',
        name: 'User Wallet',
        description: 'Main user balance',
        color: 'blue',
      },
      {
        address: '@platform:revenue',
        name: 'Platform Revenue',
        description: 'Fees collected',
        color: 'green',
      },
    ],

    // Variables used throughout the demo
    variables: {
      USER_ID: 'user-123',
      AMOUNT: '10000',  // In cents
    },

    // Transaction steps with executable Numscript
    transactionSteps: [
      {
        txType: 'DEPOSIT',  // Must match metadata "type"
        label: 'User Deposit',
        description: 'User deposits $100 into their wallet',
        numscript: `send [USD/2 10000] (
  source = @world
  destination = @users:{USER_ID}:wallet
)

set_tx_meta("type", "DEPOSIT")
set_tx_meta("user_id", "{USER_ID}")`,
        // Step-specific queries shown after this transaction
        queries: [
          {
            title: 'Wallet Balance',
            description: 'Funds now available in wallet',
            queryType: 'balance',
            addressFilter: 'users:{USER_ID}:wallet',
          },
        ],
      },
      {
        txType: 'PURCHASE',
        label: 'Make Purchase',
        description: 'User buys something for $25',
        numscript: `send [USD/2 2500] (
  source = @users:{USER_ID}:wallet
  destination = @platform:revenue
)

set_tx_meta("type", "PURCHASE")
set_tx_meta("user_id", "{USER_ID}")`,
        queries: [
          {
            title: 'Remaining Balance',
            description: 'What the user has left',
            queryType: 'balance',
            addressFilter: 'users:{USER_ID}:wallet',
          },
          {
            title: 'Platform Revenue',
            description: 'Fees collected',
            queryType: 'balance',
            addressFilter: 'platform:revenue',
          },
        ],
      },
    ],

    // General queries available in the Explore section at the end
    usefulQueries: [
      {
        title: 'User Balance',
        description: 'Current balance in user wallet',
        queryType: 'balance',
        addressFilter: 'users:{USER_ID}:wallet',
      },
      {
        title: 'Total User Funds',
        description: 'Aggregate across all user accounts using $or',
        queryType: 'balance',
        addressFilters: [  // Multiple addresses = $or query
          'users:{USER_ID}:wallet',
          'users:{USER_ID}:pending',
        ],
      },
      {
        title: 'User Transactions',
        description: 'All transactions for this user',
        queryType: 'transactions',
        transactionFilter: {
          account: 'users:{USER_ID}:',
        },
      },
      {
        title: 'All User Accounts',
        description: 'List accounts matching pattern',
        queryType: 'accounts',
        accountAddress: 'users:{USER_ID}:',
      },
    ],
  },
};
```

---

## Query Types

### Address Pattern Matching

Addresses use colon-delimited segments with wildcard support:
- **Trailing colon** (`customers:`) - Matches all accounts starting with this prefix
- **Empty segment** (`customers::pending`) - Matches any single value in that position (e.g., `customers:12345:pending`, `customers:67890:pending`)
- **Explicit address** (`customers:12345:wallet`) - Matches exactly that account

### `balance` - Single Account or Pattern
```typescript
// Exact account
{
  queryType: 'balance',
  addressFilter: 'users:123:wallet',
}

// Pattern: all accounts under users:123:
{
  queryType: 'balance',
  addressFilter: 'users:123:',  // Trailing colon = wildcard
}

// Pattern: all pending accounts for ANY user
{
  queryType: 'balance',
  addressFilter: 'users::pending',  // Empty segment = any value
}
```

### `balance` - Multiple Accounts with $or Aggregation
```typescript
{
  queryType: 'balance',
  addressFilters: [  // Uses $or filter - aggregates totals
    'users:123:available',
    'users:123:pending',
    'users:123:withdrawable',
  ],
}
```

API equivalent:
```json
{
  "$or": [
    { "$match": { "address": "users:123:available" } },
    { "$match": { "address": "users:123:pending" } },
    { "$match": { "address": "users:123:withdrawable" } }
  ]
}
```

### `transactions` - Filter by Account
```typescript
{
  queryType: 'transactions',
  transactionFilter: {
    account: 'users:123:',  // Matches source OR destination
  },
}
```

### `transactions` - Filter by Metadata (Customer Journey)

This is powerful for tracking a customer's complete journey through the system:

```typescript
// All transactions for a specific customer
{
  queryType: 'transactions',
  transactionFilter: {
    metadata: { customer_id: '12345' },
  },
}

// All deposit transactions
{
  queryType: 'transactions',
  transactionFilter: {
    metadata: { type: 'DEPOSIT_INITIATED' },
  },
}

// All winning wagers for a customer
{
  queryType: 'transactions',
  transactionFilter: {
    metadata: { customer_id: '12345', type: 'WAGER_WON' },
  },
}
```

API equivalent:
```json
{
  "$and": [
    { "$match": { "metadata[customer_id]": "12345" } },
    { "$match": { "metadata[type]": "WAGER_WON" } }
  ]
}
```

### `accounts` - List Matching Pattern
```typescript
{
  queryType: 'accounts',
  accountAddress: 'users:123:',  // Pattern to match
}
```

---

## Impressive Query Examples

### Aggregation Queries (Not Just Single Accounts!)

**Platform-Wide Liabilities:**
```typescript
{
  title: 'Total Customer Liabilities',
  description: 'All funds held for ALL customers',
  queryType: 'balance',
  addressFilter: 'customers:',  // Aggregates ALL customer accounts
}
```

**All Locked Wagers:**
```typescript
{
  title: 'Platform-Wide Locked Wagers',
  description: 'All customer funds currently locked in active bets',
  queryType: 'balance',
  addressFilter: 'customers::pending:wager',  // :: matches any customer ID
}
```

**Customer Total Value:**
```typescript
{
  title: 'Customer Total Value',
  description: 'All funds across this customer\'s accounts',
  queryType: 'balance',
  addressFilters: [  // $or aggregation
    'customers:12345:available',
    'customers:12345:deposits:pending',
    'customers:12345:pending:wager',
    'customers:12345:withdrawable',
  ],
}
```

### Metadata-Based Transaction Filtering (Customer Journey)

**Track Complete Customer Journey:**
```typescript
{
  title: 'Complete Customer Journey',
  description: 'From deposit → wagering → withdrawal using metadata',
  queryType: 'transactions',
  transactionFilter: {
    metadata: { customer_id: '12345' },
  },
}
```

**Track Remittance Flow:**
```typescript
{
  title: 'Remittance Journey',
  description: 'USDT → conversion → wire → settlement',
  queryType: 'transactions',
  transactionFilter: {
    metadata: { remittance_id: 'REM-001' },
  },
}
```

**Filter by Transaction Type:**
```typescript
{
  title: 'All Winning Wagers',
  description: 'Filter by outcome',
  queryType: 'transactions',
  transactionFilter: {
    metadata: { type: 'WAGER_WON' },
  },
}
```

---

## Formance Query Reference

### Filtering Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `$match` | Equality check | `{ "$match": { "address": "users:123" } }` |
| `$or` | Any condition matches | `{ "$or": [{ "$match": {...} }, { "$match": {...} }] }` |
| `$and` | All conditions match | `{ "$and": [{ "$match": {...} }, { "$match": {...} }] }` |
| `$exists` | Metadata field exists | `{ "$exists": { "metadata[customer_id]": true } }` |
| `$lt`, `$lte`, `$gt`, `$gte` | Numeric comparisons | For balance and timestamp filtering |
| `$not` | Inverts result | `{ "$not": { "$match": {...} } }` |

### Filterable Fields

**Accounts:** `address`, `first_usage`, `metadata`, `balance[ASSET]`, `insertion_date`, `updated_at`

**Transactions:** `id`, `reference`, `timestamp`, `reverted`, `source`, `destination`, `account`, `metadata`, `inserted_at`, `updated_at`

### Metadata Filtering Syntax

Metadata uses bracket notation in the filter:
```json
{ "$match": { "metadata[customer_id]": "12345" } }
{ "$match": { "metadata[type]": "DEPOSIT_INITIATED" } }
```

Multiple metadata conditions:
```json
{
  "$and": [
    { "$match": { "metadata[customer_id]": "12345" } },
    { "$match": { "metadata[type]": "WAGER_WON" } }
  ]
}
```

---

## Available Demo Configurations

### `sportsbet`

**Name:** Sportsbet Wagering Flow
**Use Case:** Sports betting platform with customer wallets

**Flow:**
1. Seed Platform Float - Initialize house bankroll
2. Deposit Initiated - Customer deposits (pending)
3. Deposit Confirmed - Payment confirmed, funds available
4. Place Wager - Customer places bet, funds locked
5. Wager Won - Customer wins, stake + profit returned
6. Withdrawal Initiated - Customer requests withdrawal
7. Withdrawal Settled - Funds sent to bank

**Key Accounts:**
- `@platform:float` - House money for payouts
- `@customers:{ID}:available` - Funds for betting
- `@customers:{ID}:pending:wager` - Locked during bet
- `@customers:{ID}:withdrawable` - Can be withdrawn

### `coins-ph`

**Name:** Cross-Border Remittance (Exchange Accounts)
**Use Case:** USDT→BRL remittance with tracked FX conversions

**Flow:**
1. USDT Received - Client sends USDT
2. FX Conversion - USDT/BRL exchange with unique exchange account + metadata
3. Wire Initiated - Send BRL to recipient + collect fee
4. Wire Settled - Transfer complete

**Key Accounts:**
- `@treasury:binance:hot` - USDT holdings
- `@exchanges:{EXCHANGE_ID}` - **Per-exchange account** with metadata (rate, amounts, timestamp)
- `@banks:bradesco:operating` - BRL operating account
- `@platform:revenue` - Fee collection

**Why Exchange Accounts?**
Each FX conversion gets its own account (`@exchanges:usdt:brl:001`) with:
- `allowing overdraft` - External entity (broker) can go negative
- Account metadata - Stores rate, amounts, execution time
- Queryable - List all exchanges to see conversion history
- No pre-funding needed - overdraft handles external entities

---

## Best Practices

### Currency Conversion - Use Exchange Accounts with Overdraft

**Never do this** - creating currency from `@world`:
```numscript
// BAD: Unbounded currency creation, no audit trail
send [USDT/6 10000000000] (
  source = @treasury:hot
  destination = @world  // USDT disappears into void
)
send [BRL/2 5450000] (
  source = @world  // BRL appears from nothing
  destination = @banks:operating
)
```

**Use exchange accounts with IDs and metadata:**
```numscript
send [USDT/6 10000000000] (
  source = @treasury:hot
  destination = @exchanges:usdt:brl:001
)

send [BRL/2 5450000] (
  source = @exchanges:usdt:brl:001 allowing unbounded overdraft
  destination = @banks:operating
)

set_account_meta(@exchanges:usdt:brl:001, "type", "USDT_BRL")
set_account_meta(@exchanges:usdt:brl:001, "rate", "5.45")
set_account_meta(@exchanges:usdt:brl:001, "usdt_amount", "10000")
set_account_meta(@exchanges:usdt:brl:001, "brl_amount", "54500")
set_account_meta(@exchanges:usdt:brl:001, "executed_at", "2024-01-15T10:30:00Z")
```

Note: Numscript does not support inline comments (`//`). Comments in the examples above are for documentation only.

**Why?**
1. **`allowing overdraft`** - Exchange accounts represent external entities (brokers), so they can go negative
2. **Unique exchange IDs** - Each conversion gets its own account (`@exchanges:usdt:brl:001`, `@exchanges:EXC-002`)
3. **Account metadata** - Store rate, amounts, timestamps on the exchange account itself
4. **Query all exchanges** - List `@exchanges:` to see all conversions with their metadata
5. **Audit trail** - Each exchange is a permanent record with full details

**No pre-funding needed** - the `allowing overdraft` clause handles external entities.

See: https://docs.formance.com/modules/ledger/working-with-the-ledger/currency-conversion

### General
1. **Use meaningful variable names** - `{CUSTOMER_ID}` not `{ID}`
2. **Set comprehensive metadata** - Include business context on transactions (`customer_id`, `type`, `remittance_id`, etc.)
3. **Keep account colors consistent** - Blue for customers, green for platform, etc.
4. **Write clear descriptions** - These appear in the UI for the audience

### Making Queries Impressive

**DON'T:** Just show single account balances
```typescript
// Boring - customers already know this works
{ addressFilter: 'customers:12345:available' }
```

**DO:** Use aggregation to answer meaningful business questions
```typescript
// Impressive - shows platform-wide visibility
{ addressFilter: 'customers:' }  // Total liabilities
{ addressFilter: 'customers::pending:wager' }  // All locked wagers
```

**DO:** Use $or to aggregate across account types
```typescript
// Impressive - complete picture of customer value
{
  addressFilters: [
    'customers:12345:available',
    'customers:12345:pending:wager',
    'customers:12345:withdrawable',
  ]
}
```

**DO:** Track customer journeys with metadata filtering
```typescript
// Impressive - traces full customer lifecycle
{
  transactionFilter: {
    metadata: { customer_id: '12345' }
  }
}
```

**DO:** Filter by transaction type for operational insights
```typescript
// Impressive - operational visibility
{ transactionFilter: { metadata: { type: 'WAGER_WON' } } }
{ transactionFilter: { metadata: { type: 'WITHDRAWAL_INITIATED' } } }
```

### Metadata Strategy

Always set these metadata fields on transactions:
- `type` - Transaction type (e.g., `DEPOSIT_INITIATED`, `WAGER_PLACED`, `WAGER_WON`)
- `customer_id` / `client` - Who this transaction belongs to
- Business-specific IDs (`wager_id`, `remittance_id`, `withdrawal_id`)
- Contextual data (`event`, `odds`, `exchange_rate`, `fee`)

---

## UI Implementation Notes

### Transaction Display
When displaying transactions from API queries:
- Show full account addresses (no truncation) - use `break-all` CSS
- Format dates safely - check for invalid dates before displaying
- Show "From" and "To" labels clearly with color coding (red for source, green for destination)
- Include amount with currency for each posting

### Transaction Flow Diagram Parsing

The `TransactionFlowDiagram` component (`/app/components/demo/transaction-flow-diagram.tsx`) provides:

**Numscript Parsing:**
```typescript
import { parsePostingsFromNumscript, parseMetadataFromNumscript } from './transaction-flow-diagram';

// Extract postings from Numscript
const postings = parsePostingsFromNumscript(numscript);
// Returns: [{ amount: 'USD/2 10000', source: 'world', destination: 'user:wallet' }]

// Extract metadata keys
const { txMeta, accountMeta } = parseMetadataFromNumscript(numscript);
// txMeta: ['type', 'customer_id']
// accountMeta: ['rate', 'executed_at']
```

**Flow Diagram Usage:**
```typescript
import { TransactionFlowDiagram, parsePostingsFromNumscript, parseMetadataFromNumscript } from './transaction-flow-diagram';

const postings = parsePostingsFromNumscript(step.numscript);
const { txMeta, accountMeta } = parseMetadataFromNumscript(step.numscript);

<TransactionFlowDiagram
  postings={postings}
  description={step.description}
  txMeta={txMeta}
  accountMeta={accountMeta}
/>
```

**Intermediary Flow Detection:**
The diagram automatically detects when two postings share an intermediary account (destination of posting 1 = source of posting 2) and renders a vertical flow instead of horizontal rows.

### SDK Parameters
When calling the Formance SDK:
- **Balance queries**: Use `query` parameter (not `requestBody`)
- **Transaction queries**: Use `query` parameter (not `requestBody`)
- **Account queries**: Use `query` parameter (not `requestBody`)

Example:
```typescript
// Correct
api.sdk.ledger.v2.listTransactions({ ledger, query: { $match: ... } });

// Wrong - SDK ignores requestBody
api.sdk.ledger.v2.listTransactions({ ledger, requestBody: { $match: ... } });
```

---

## Troubleshooting

**Demo mode doesn't activate:**
- Verify `?demo=true` is in the URL
- Check ledger has `demo` metadata
- Confirm metadata value matches a config key

**Transactions fail:**
- Check Numscript syntax
- Verify source accounts have sufficient balance
- Look at error message in the UI

**Balance queries return 0:**
- Run transactions first to create accounts
- Check address patterns are correct
- Use `addressFilters` (array) for $or queries

**Metadata filter queries return no transactions:**
- Verify the transaction was actually created with that metadata
- Check that variable interpolation is working - the demo UI interpolates `{VARIABLE_NAME}` placeholders before sending queries
- Variables like `{CUSTOMER_ID}`, `{REMITTANCE_ID}` are replaced with actual values from `demoConfig.variables`
- If a query shows `metadata[remittance_id]: "{REMITTANCE_ID}"` in the request body (with braces), interpolation is broken
- The correct request body should show `metadata[remittance_id]: "REM-001"` (actual value)

**Clear Ledger fails:**
- The "Clear Ledger" feature uses direct SQL to delete data from PostgreSQL
- Requires `LEDGER_DATABASE_URL` environment variable to be set
- Requires postgres port-forward: `kubectl port-forward -n formance-system svc/postgresql 5432:5432`
- Connection string format: `postgresql://user:password@host:port/database`
- For local minikube: `LEDGER_DATABASE_URL=postgresql://formance:formance@localhost:5432/yhkjzhkjctlk-txpg-ledger`
- **Schema detection**: Ledgers with their own bucket (recommended) use the bucket name as the PostgreSQL schema (e.g., `monetae-demo` ledger with `bucket: "monetae-demo"` uses schema `monetae-demo`). Ledgers in the default bucket use the `_default` schema.

---

## Demo Controls

### Header Buttons

The demo header provides several control buttons:

| Button           | Action                                                                   |
| ---------------- | ------------------------------------------------------------------------ |
| **Restart**      | Resets to the intro screen but keeps executed transactions               |
| **Clear Ledger** | Deletes ALL data (transactions, accounts) and recreates the ledger fresh |
| **Exit Demo**    | Returns to normal console view                                           |

### Clear Ledger

The "Clear Ledger" button provides a true reset for demos using direct SQL:
- Deletes all transactions, accounts, postings, logs, and metadata from PostgreSQL
- Preserves the ledger structure and metadata (just clears the data)
- Resets all UI state (executed steps, query results, balances)
- Returns to the intro screen

**Requirements:**
- `LEDGER_DATABASE_URL` environment variable must be set in `.env`
- Postgres port-forward running: `kubectl port-forward -n formance-system svc/postgresql 5432:5432`
- For local minikube: `LEDGER_DATABASE_URL=postgresql://formance:formance@localhost:5432/yhkjzhkjctlk-txpg-ledger`

**How it works:**
- Detects the PostgreSQL schema based on ledger/bucket name (tries ledger name first, then `_default`)
- Ledgers with their own bucket use the bucket name as schema (e.g., `monetae-demo`)
- Deletes from: accounts_volumes, accounts_metadata, transactions_metadata, moves, logs, transactions, accounts

---

## Related

- [[Running Demos Locally]]
- [[Account Naming Conventions]]
- [[Common Flow Patterns]]
