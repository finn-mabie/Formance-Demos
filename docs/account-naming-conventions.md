# Account Naming Conventions

Best practices for structuring and naming accounts in Formance demos.

---

## Critical Principles

**READ THIS FIRST - these are the most common mistakes:**

### 1. Use Colons for ALL Separation in Account Names (No Underscores)

Account name segments are separated by colons. **Do NOT use underscores in account names** - add more colon-separated segments instead.

**Note:** This rule applies to **account names only**. Metadata keys CAN use underscores (e.g., `blockchain_tx`, `exchange_rate`).

```
WRONG (underscores):
@interco:ph:owed_to_ph
@merchants:acme_corp:pending
@clients:manila_mfg:received
@escrow:order_123

RIGHT (colons only):
@interco:ph:debt
@merchants:acmecorp:pending
@clients:manilamfg:received
@escrow:ord:123
```

If you need multiple words, either:
- Remove spaces/underscores: `acmecorp`, `manilamfg`
- Add more segments: `@interco:ph:we:owe` (though this is verbose)
- Use abbreviations: `@interco:ph:debt`

### 1b. IDs Should Be Colon-Separated Segments (For Aggregation)

**CRITICAL**: When including IDs in account names, use colon-separated segments, NOT concatenated strings. This enables Formance's aggregate balance queries.

```
WRONG (concatenated IDs - breaks aggregation):
@customers:cust001
@customers:cust002
@exchanges:CONV001

RIGHT (colon-separated IDs - enables aggregation):
@customers:001
@customers:002
@exchanges:conv:001
```

**Why this matters:**

With concatenated IDs like `cust001`, you can only query:
- `customers:cust001` (exact match)
- `customers:` (all customers - too broad)

With colon-separated IDs like `001`, you can query:
- `customers:001` (exact match)
- `customers::centralbank` (all customer centralbank accounts)
- `customers::fireblocks:hot` (all customer Fireblocks accounts)

The empty segment `::` acts as a wildcard for that position, enabling powerful aggregation.

**Pattern:**
```
@{category}:{id}:{location}

Examples:
@customers:001                     # Customer 001's main account (multi-asset)
@customers:001:fireblocks:hot      # Customer 001's Fireblocks custody
@customers:001:centralbank         # Customer 001's fiat at central bank
@exchanges:conv:001                # Conversion 001
@banks:centralbank:pending:ach:001 # ACH 001 pending
```

**Note:** Don't duplicate the category in the ID. `@customers:cust:001` is redundant - use `@customers:001` instead.

### 2. Accounts are Multi-Asset - NEVER Include Asset Type in Account Names

Formance accounts can hold **multiple asset types simultaneously**. **NEVER** include asset type (usd, usdc, fiat, btc, etc.) in account names.

```
WRONG:
@users:alice:usd:available
@users:alice:btc:available
@users:alice:usdc:available
@users:alice:fiat
@users:alice:usdc
@customers:001:fiat
@customers:001:usdc

RIGHT:
@users:alice:available    ← This single account holds USD, BTC, USDC, etc.
@customers:001            ← Holds all assets for this customer
```

**Why this matters:**
- One account can hold USD, USDC, BTC, TSLA tokens, etc. simultaneously
- Query by asset type at the API level, not account structure
- Simpler account hierarchy
- Enables queries like "all USD held for customers" across all customer accounts

### 3. Per-Customer Custody Accounts (Not Shared Treasury)

When custodying assets for customers (e.g., in Fireblocks), use **per-customer custody accounts**, NOT a shared treasury account. This ensures you always know whose assets are whose.

```
WRONG (shared treasury - whose funds are these?):
@treasury:fireblocks:hot              ← All customer USDC mixed together
// Can't tell Alice's USDC from Bob's!

RIGHT (per-customer custody):
@customers:001:fireblocks:hot    ← Customer 001's USDC in Fireblocks
@customers:002:fireblocks:hot    ← Customer 002's USDC in Fireblocks
// Aggregate: customers::fireblocks:hot gives total
```

**Why this matters:**
- Know exactly whose funds are in custody at any time
- Regulatory compliance - can prove individual ownership
- Query `@customers::fireblocks:hot` to get total for Fireblocks reconciliation

### 3b. Use General Pool Accounts (Not Per-Asset)

Platform pool accounts (like investment pools) should be **multi-asset**, NOT per-asset. Same principle as customer accounts.

```
WRONG (per-asset pools):
@platform:investments:tsla            ← TSLA pool
@platform:investments:aapl            ← AAPL pool
@platform:investments:googl           ← GOOGL pool
// Creates many accounts, harder to manage

RIGHT (general multi-asset pool):
@platform:investments                 ← Holds USDC received, issues TSLA/AAPL/etc.
// One account, multiple assets
```

**Why this matters:**
- Simpler account structure
- Same pattern as customer accounts (multi-asset)
- Easier reconciliation

### 4. No Double Counting

In omnibus/custody models, **customer accounts represent ownership**. The omnibus total is **derived by summing customer accounts**, NOT tracked separately.

```
WRONG (double counts):
@customers:alice:hot = 0.25 BTC       ← Alice owns 0.25 BTC
@omnibus:btc:hot = 0.25 BTC           ← Omnibus has 0.25 BTC
// If you query both, you'd think there's 0.5 BTC!

RIGHT:
@customers:alice:hot = 0.25 BTC       ← Alice owns 0.25 BTC in hot wallet
// Total hot wallet = sum of all @customers:*:hot
// No separate omnibus balance account needed
```

### 4. Make Account Purpose Clear

Every account name should answer: **"What is this money for?"** or **"Who owns this?"**

```
WRONG (vague):
@exchanges:binance              ← Who owns this? What's it for?
@banks:main                     ← Main what?
@clients:acme:pending           ← Pending what?

RIGHT (clear purpose):
@treasury:binance:hot           ← Our working capital on Binance
@banks:bradesco:operating       ← Operating account at Bradesco
@remittances:REM001:inflight    ← Remittance REM001 in progress
```

For exchange/custody accounts, clarify:
- **Whose money is it?** (treasury, client, float)
- **What's the purpose?** (hot, cold, settlement, pending)

### 5. Distinguish Asset Accounts vs Tracking Accounts

**Asset accounts** = where money actually is (bank, exchange, wallet)
**Tracking accounts** = obligations, status, or lifecycle stages

```
ASSET ACCOUNTS (real money location):
@treasury:binance:hot           ← USDT we hold on Binance
@banks:bradesco:operating       ← BRL in our bank account

TRACKING ACCOUNTS (obligations/status):
@interco:ph:debt                ← What we owe Philippines (liability)
@remittances:REM001:inflight    ← Tracks remittance status (not actual $)
```

**Key rule**: Money should flow through asset accounts. Tracking accounts record obligations or status.

### 6. Use Engineer-Friendly Names

Engineers use this platform, not accountants. Avoid accounting jargon.

```
WRONG (accounting terms):
@interco:ph:payable
@interco:ph:receivable
@users:alice:assets

RIGHT (clear intent):
@interco:ph:debt                ← What we owe to Philippines
@interco:ph:credit              ← What Philippines owes us
@users:alice:balance
```

### 7. Customer Accounts Indicate Pool Location

For custody/omnibus models, the account suffix should indicate WHERE assets are held:

```
@customers:alice:hot        ← Alice's share in hot wallet pool
@customers:alice:cold       ← Alice's share in cold storage pool
@customers:alice:hold:WD123 ← Funds on hold for pending operation
```

### 8. Keep Account Structures Scannable

Use short section headers. Put explanations outside the code block.

```
CUSTOMERS
├── @customers:alice:hot
├── @customers:alice:cold
└── @customers:alice:hold:WD001
```

### 9. Use Account Metadata for Details

Track account-level info with `set_account_meta()`, not in account names:

```numscript
send [USD/2 10000] (
  source = @world
  destination = @customers:alice:hot
)

set_account_meta(@customers:alice:hot, "custodian", "coinbase")
set_account_meta(@customers:alice:hot, "customer_name", "Alice Smith")
set_account_meta(@customers:alice:hot, "kyc_status", "verified")
```

---

## Naming Rules

### Account Name Syntax
Account addresses must match: `^[a-zA-Z_0-9]+(:[a-zA-Z_0-9]+){0,}$`

- Start with letter, underscore, or number
- Use colons (`:`) to create hierarchy
- No spaces, dashes, or special characters
- **Convention:** Avoid underscores even though technically valid - use colons or concatenation instead

### Metadata Key Syntax
Metadata keys should use underscores:

```
remittance_ref      ✓
blockchain_tx       ✓
exchange_rate       ✓
client_name         ✓

remittance:ref      ✗ (confusing - looks like account path)
```

**Metadata values** can use any format including colons (e.g., `"type": "USDT:RECEIVED"`).

### Good Examples
```
@users:12345:main
@merchants:acmecorp:pending
@platform:fees:processing
@banks:chase:settlement
@treasury:binance:hot
```

### Bad Examples
```
@user-12345              # No dashes
@users/12345/main        # No slashes
@platform fees           # No spaces
@interco:ph:owed_to_ph   # Underscores - use @interco:ph:debt instead
@exchanges:binance       # Too vague - use @treasury:binance:hot
```

---

## Modeling Real-World Flows

### Wire Transfers Have Pending States

Bank wires are NOT instant. Always model the pending state:

```
WRONG (assumes instant):
@world → @banks:main                    ← Wire doesn't land instantly

RIGHT (with pending):
@world → @banks:main:pending:REF123     ← Wire initiated, pending
@banks:main:pending:REF123 → @banks:main ← Wire settles
```

### Funds Should Flow Logically

Every account movement should make business sense. Ask: **"Where is this money actually going?"**

```
WRONG (illogical flow):
@clients:acme:received → @clients:acme:pending → @world
// Why does pending money go to @world? What happened to it?

RIGHT (logical flow):
@clients:acme:received → @treasury:binance:hot   ← Money goes to Binance
@treasury:binance:hot → @world                    ← We sell USDT
@world → @banks:main:operating                    ← BRL arrives
```

### Track Obligations Separately from Assets

Don't mix "tracking what we owe" with "where the money is":

```
WRONG (mixing concerns):
@clients:acme:pending = $10,000 USD   ← Is this real USD we hold? Or tracking?

RIGHT (separated):
// Asset accounts (real money):
@treasury:binance:hot                 ← USDT we actually hold
@banks:bradesco:operating             ← BRL we actually hold

// Tracking accounts (obligations):
@interco:ph:debt                      ← What we owe Philippines (goes negative)
@remittances:REM001:status            ← Optional lifecycle tracking
```

### Use Metadata for Lifecycle Tracking (Often Better Than Accounts)

Instead of creating accounts for each status, use transaction metadata:

```
SIMPLER APPROACH:
// Just track the assets, use metadata for status
send [USDT/6 10000000000] (
  source = @world
  destination = @treasury:binance:hot
)
set_tx_meta("remittance_ref", "REM001")
set_tx_meta("status", "usdt_received")
set_tx_meta("client", "manilamfg")

// Query all transactions for REM001 to see full lifecycle
GET /ledger/transactions?metadata[remittance_ref]=REM001
```

---

## Hierarchical Structure

Use colons to create logical groupings:

```
@{category}:{identifier}:{sub_account}
```

### Standard Categories

| Category | Purpose | Example |
|----------|---------|---------|
| `@world` | System account (unbounded overdraft) | `@world` |
| `@users` | End-user accounts | `@users:u_123:main` |
| `@merchants` | Business/seller accounts | `@merchants:m_456:pending` |
| `@platform` | Platform operational accounts | `@platform:fees:collected` |
| `@banks` | Bank account mirrors | `@banks:chase:main` |
| `@psp` | Payment processor accounts | `@psp:stripe:auth` |
| `@blockchain` | On-chain tracking | `@blockchain:eth:circulating` |
| `@suspense` | Temporary holding accounts | `@suspense:fraud_check` |
| `@escrow` | Escrow/holding accounts | `@escrow:order_789` |

---

## Common Sub-Account Patterns

### User Accounts
```
@users:alice:available
@users:alice:pending
@users:alice:hold:TXN001
@users:alice:bonus
@users:alice:locked
```

### Platform Accounts
```
@platform:fees
@platform:revenue
@platform:expenses
@platform:float
@platform:suspense:TXN001
```

### Bank Accounts
```
@banks:chase
@banks:chase:settlement
@banks:chase:pending:TXN001
```

### PSP Accounts
```
@psp:stripe:authorizations
@psp:stripe:settled
@psp:stripe:refunds
@psp:stripe:disputes
```

---

## Account Types by Behavior

### Asset Accounts (Positive = Good)
Represent money you **have** or are **owed**:
- Bank accounts
- PSP authorizations (receivables)
- Reserves

### Liability Accounts (Positive = Owed)
Represent money you **owe** to others:
- User balances
- Merchant payables
- Pending payouts

### The @world Account
Special account that can go negative (unbounded overdraft):
- Entry point for external money
- Exit point for withdrawals
- Always use for money entering/leaving the system
- **NEVER use `allowing unbounded overdraft` on @world** - it already has unlimited overdraft by default and will error if you specify it

---

## Naming for Compliance

### Segregation Demos
When demonstrating fund segregation:
```
Ledger: client_funds     # Segregated client money
├── @users:{id}:main

Ledger: operations       # Corporate working capital
├── @platform:operating
├── @platform:payroll
```

### Audit Trail
Include references in account names for traceability:
```
@banks:chase:withdrawal:{reference_id}
@escrow:order_{order_id}
@psp:stripe:auth:{auth_id}
```

---

## Templates by Use Case

### Wallet Platform
```
USERS
├── @users:alice:available
├── @users:alice:pending
└── @users:alice:hold:TXN001

EXTERNAL
├── @banks:chase
└── @psp:stripe

PLATFORM
├── @platform:fees
└── @platform:float
```

### Marketplace
```
BUYERS
├── @buyers:bob:available
└── @buyers:bob:hold:ORD001

SELLERS
├── @sellers:acme:available
└── @sellers:acme:pending

ESCROW
└── @escrow:ORD001

EXTERNAL
├── @banks:chase
└── @psp:stripe

PLATFORM
└── @platform:fees
```

### Stablecoin Issuer
```
RESERVES
├── @reserves:jpmorgan
└── @reserves:blackrock

SUPPLY
├── @supply:minted
└── @supply:burned

PARTNERS
└── @partners:coinbase

PLATFORM
└── @platform:fees
```

### Omnibus/Custody
```
CUSTOMERS
├── @customers:alice:hot
├── @customers:alice:cold
└── @customers:alice:hold:WD001

PROVIDERS
└── @providers:circle:debt          ← What we owe Circle

PLATFORM
├── @platform:fees
└── @platform:float
```

Total hot wallet = `sum(@customers:*:hot)`

### Cross-Border Payments (Stablecoin Sandwich)
```
TREASURY (where our money actually is)
├── @treasury:binance:hot           ← USDT working capital on Binance
├── @banks:bradesco:operating       ← BRL operating account
└── @banks:bradesco:pending:REF123  ← Wire in transit

INTERCOMPANY (what we owe/are owed)
├── @interco:ph:debt                ← What we owe Philippines (liability)
└── @interco:ph:credit              ← What Philippines owes us (if applicable)

PLATFORM (P&L)
├── @platform:revenue               ← FX spread earned
└── @platform:expenses              ← Operational costs
```

**Note**: Use transaction metadata (`remittance:ref`, `client`, `status`) to track individual remittances rather than creating client accounts. This keeps the account structure clean and queries simple.

### Wealth Tech / Fiat Custody (Monetae Pattern)
```
PENDING (not yet customer funds)
└── @banks:centralbank:pending:ach:001  ← ACH in transit

CUSTOMERS (per-customer custody - NO separate omnibus!)
├── @customers:001:centralbank     ← User's USD at central bank
├── @customers:001:fireblocks:hot  ← User's USDC in Fireblocks
└── @customers:001                 ← User's tokenized assets (TSLA, etc.)

PLATFORM
├── @platform:revenue               ← Fees collected
└── @platform:investments           ← Investment pool (multi-asset)

EXCHANGES (FX tracking - bidirectional swap with @world)
└── @exchanges:conv:001             ← Per-conversion record with rate metadata
```

**Key patterns:**
- **NO separate omnibus account** - derive totals from customer accounts
- Per-customer fiat: `@customers:001:centralbank`
- Per-customer crypto: `@customers:001:fireblocks:hot`
- 1:1 backing check: `SUM(@customers::centralbank)` = actual central bank balance
- Fireblocks reconciliation: `SUM(@customers::fireblocks:hot)` = Fireblocks API balance
- General investment pool, not per-asset

**Exchange pattern for currency conversion:**
```numscript
// 1. Customer sends fiat to exchange account
send [USD/2 500000] (
  source = @customers:001:centralbank
  destination = @exchanges:conv:001
)

// 2. Exchange swaps with @world (the actual conversion)
send [USD/2 499000] (
  source = @exchanges:conv:001
  destination = @world
)

send [USDC/6 4990000000] (
  source = @world
  destination = @exchanges:conv:001
)

// 3. Exchange distributes: USDC to customer, fee to platform
send [USDC/6 4990000000] (
  source = @exchanges:conv:001
  destination = @customers:001:fireblocks:hot
)

send [USD/2 1000] (
  source = @exchanges:conv:001
  destination = @platform:revenue
)

// Store rate metadata on exchange account
set_account_meta(@exchanges:conv:001, "type", "USD_USDC")
set_account_meta(@exchanges:conv:001, "rate", "0.998")
```

**Diagram visualization:**

*Simple flows (e.g., ACH deposit):*
- @world appears at the **top** of the vertical tree as a root node
- Funds flow **downward** from @world to destination accounts
- Example: `@world` → `@banks:centralbank:pending:ach:001`

*Exchange flows (bidirectional swap with @world):*
- @world is positioned as a **sidecar** to the right of the exchange account (same Y level, 180px gap)
- Two parallel horizontal arrows connect exchange ↔ @world:
  - Top arrow: one direction (e.g., USD out to @world)
  - Bottom arrow: opposite direction (e.g., USDC in from @world)
- Arrow labels are positioned **above/below** their respective arrows (not on top of them)
- The main transaction tree flows vertically; the exchange-@world swap is a horizontal sidecar

*General:*
- Labels use small pill-shaped backgrounds (45px min width, 16px height, 10px font)
- Diagrams are **editable**: drag nodes, double-click to edit text, add/delete boxes and arrows
- Layouts persist to localStorage per demo/transaction type - click "Save" to store, "Reset" to restore defaults

**Same pattern for any exchange (FX, investments, etc.):**
- USDC→TSLA investment uses same pattern: exchange ↔ @world swap
- Store exchange metadata (rate, amounts) on the exchange account

---

## Related
- [[Demo Building Overview]]
- [[Numscript Quick Reference]]
- [[Common Flow Patterns]]
