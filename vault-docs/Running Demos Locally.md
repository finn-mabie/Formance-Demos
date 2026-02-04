# Running Demos Locally

How to run demo numscripts against your local Formance deployment.

---

## Console URL Structure

Your local console URL follows this pattern:
```
http://localhost:3200/{org}/{stack}/ledgers/{ledger}?region=local-dev
```

For the standard local setup:
- **Org**: `yhkjzhkjctlk`
- **Stack**: `txpg`
- **Region**: `local-dev`

Examples:
```
# List all ledgers
http://localhost:3200/yhkjzhkjctlk/txpg/ledgers/all?region=local-dev

# View a specific ledger
http://localhost:3200/yhkjzhkjctlk/txpg/ledgers/monetae-demo?region=local-dev

# View a ledger in demo mode
http://localhost:3200/yhkjzhkjctlk/txpg/ledgers/monetae-demo?region=local-dev&demo=true
```

---

## Prerequisites

1. **Minikube running** with Formance stack deployed
2. **Gateway port-forwarded** to localhost:8081
3. **jq** installed for JSON parsing

Check status:
```bash
# Is minikube running?
minikube status

# Are pods healthy?
kubectl get pods -n yhkjzhkjctlk-txpg

# Is gateway port-forwarded?
lsof -i:8081
```

---

## Quick Start

### 1. Start the gateway port-forward

```bash
kubectl port-forward -n yhkjzhkjctlk-txpg svc/gateway 8081:8080 &
```

### 2. Get an auth token

```bash
TOKEN=$(curl -s http://localhost:8081/api/auth/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=local-test-client&client_secret=local-test-secret" \
  | jq -r '.access_token')
```

### 3. Create a ledger

```bash
LEDGER="my-demo-ledger"

curl -X POST "http://localhost:8081/api/ledger/v2/$LEDGER" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metadata": {"demo": "true"}}'
```

### 4. Run a numscript transaction

```bash
curl -X POST "http://localhost:8081/api/ledger/v2/$LEDGER/transactions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "script": {
      "plain": "send [USD/2 10000] (\n  source = @world\n  destination = @customer:alice\n)\n\nset_tx_meta(\"type\", \"DEPOSIT\")"
    }
  }' | jq .
```

### 5. Check balances

```bash
curl -s "http://localhost:8081/api/ledger/v2/$LEDGER/accounts?expand=volumes" \
  -H "Authorization: Bearer $TOKEN" | jq '.cursor.data[] | {address: .address, balances: .volumes}'
```

---

## API Reference

### Base URL
```
http://localhost:8081/api/ledger/v2/{ledger}
```

### Authentication
All requests need `Authorization: Bearer $TOKEN` header.

### Key Endpoints

| Action | Method | Endpoint |
|--------|--------|----------|
| List ledgers | GET | `/api/ledger/v2` |
| Create ledger | POST | `/api/ledger/v2/{ledger}` |
| Get ledger info | GET | `/api/ledger/v2/{ledger}` |
| Create transaction | POST | `/api/ledger/v2/{ledger}/transactions` |
| List transactions | GET | `/api/ledger/v2/{ledger}/transactions` |
| List accounts | GET | `/api/ledger/v2/{ledger}/accounts` |
| Aggregate balances | GET | `/api/ledger/v2/{ledger}/aggregate/balances` |

---

## Numscript Syntax Notes

### Basic send
```numscript
send [USD/2 10000] (
  source = @world
  destination = @customer:alice
)
```

### Multiple sends in one transaction
```numscript
send [USDT/6 1000000] (
  source = @treasury:hot
  destination = @world
)

send [BRL/2 550000] (
  source = @world
  destination = @banks:operating
)
```

### Allowing overdraft
Put `allowing unbounded overdraft` on the **source** line:
```numscript
send [USD/2 1000] (
  source = @expenses allowing unbounded overdraft
  destination = @vendor:aws
)
```

### Setting metadata
```numscript
set_tx_meta("type", "PAYMENT")
set_tx_meta("reference", "PAY-001")
set_tx_meta("client", "Acme Corp")
```

### Common gotchas

1. **Multi-destination syntax doesn't work** - use separate sends instead:
   ```numscript
   // DON'T DO THIS - won't compile
   send [USD/2 10000] (
     source = @world
     destination = {
       [USD/2 500] to @fees
       remaining to @customer
     }
   )

   // DO THIS INSTEAD
   send [USD/2 500] (
     source = @world
     destination = @fees
   )
   send [USD/2 9500] (
     source = @world
     destination = @customer
   )
   ```

2. **`allowing unbounded overdraft`** goes on source, not destination

3. **Escape quotes** in JSON when using curl:
   ```bash
   -d '{"script": {"plain": "set_tx_meta(\"key\", \"value\")"}}'
   ```

---

## Running Demo Scripts

Each demo in `/Demos/{company}/` can have a `run-demo.sh` script.

### Coins.ph Demo
```bash
cd /Users/finnmabie/Documents/finns-vault/Formance/Demos/Coins.ph
./run-demo.sh
```

This runs the full 4-step stablecoin sandwich flow:
1. USDT arrives (settlement)
2. Sell USDT for BRL
3. Initiate wire to recipient
4. Wire settles

### Environment Variables

Scripts support these env vars:
```bash
API_URL=http://localhost:8081   # Gateway URL
CLIENT_ID=local-test-client     # OAuth client ID
CLIENT_SECRET=local-test-secret # OAuth client secret
LEDGER=my-ledger                # Ledger name to use
```

Example:
```bash
LEDGER=coins-demo-v2 ./run-demo.sh
```

---

## Viewing Results in Console

After running a demo, view results in the Formance console:

1. Start the console (if not running):
   ```bash
   cd /Users/finnmabie/Documents/my-local-set-up
   ./start-console.sh
   ```

2. Open in browser:
   ```
   http://localhost:3200/yhkjzhkjctlk/txpg/ledgers/{ledger}?region=local-dev
   ```

---

## Troubleshooting

### "Failed to get auth token"
- Make sure gateway is port-forwarded: `kubectl port-forward -n yhkjzhkjctlk-txpg svc/gateway 8081:8080`

### "Connection refused"
- Check minikube is running: `minikube status`
- Check pods are healthy: `kubectl get pods -n yhkjzhkjctlk-txpg`

### Numscript compilation errors
- Check syntax - see "Common gotchas" above
- Test with a simple transaction first

### "insufficient funds"
- Check account has balance: query accounts with `?expand=volumes`
- Use `allowing unbounded overdraft` on source if needed

---

---

## Database Access (Admin)

Since this is a local deployment, you have direct database access for admin tasks.

### Connecting to the Database

```bash
# List databases
kubectl exec -n formance-system postgresql-0 -- psql -U formance -d formance -c "\l"

# Connect to ledger database
kubectl exec -n formance-system postgresql-0 -- psql -U formance -d "yhkjzhkjctlk-txpg-ledger"
```

### Database Structure

- **Database**: `yhkjzhkjctlk-txpg-ledger`
- **Ledger registry**: `_system.ledgers` table
- **Each ledger's data**: Stored in bucket schemas (e.g., `_default`, `moneyfarm`, etc.)

### Listing All Ledgers

```bash
kubectl exec -n formance-system postgresql-0 -- psql -U formance -d "yhkjzhkjctlk-txpg-ledger" \
  -c "SELECT id, name, bucket FROM _system.ledgers ORDER BY id;"
```

### Deleting a Ledger

Ledgers can't be deleted via API (immutability), but locally you can delete directly.

**Important:** You must clean up ALL related tables, not just the ledger registry.

```bash
LEDGER="ledger-to-delete"
DB="yhkjzhkjctlk-txpg-ledger"

# 1. Delete from system registry
kubectl exec -n formance-system postgresql-0 -- psql -U formance -d "$DB" \
  -c "DELETE FROM _system.ledgers WHERE name = '$LEDGER';"

# 2. Clean up ALL data tables (order matters for foreign keys)
kubectl exec -n formance-system postgresql-0 -- psql -U formance -d "$DB" \
  -c "DELETE FROM \"_default\".accounts_volumes WHERE ledger = '$LEDGER';"
kubectl exec -n formance-system postgresql-0 -- psql -U formance -d "$DB" \
  -c "DELETE FROM \"_default\".accounts_metadata WHERE ledger = '$LEDGER';"
kubectl exec -n formance-system postgresql-0 -- psql -U formance -d "$DB" \
  -c "DELETE FROM \"_default\".transactions_metadata WHERE ledger = '$LEDGER';"
kubectl exec -n formance-system postgresql-0 -- psql -U formance -d "$DB" \
  -c "DELETE FROM \"_default\".moves WHERE ledger = '$LEDGER';"
kubectl exec -n formance-system postgresql-0 -- psql -U formance -d "$DB" \
  -c "DELETE FROM \"_default\".logs WHERE ledger = '$LEDGER';"
kubectl exec -n formance-system postgresql-0 -- psql -U formance -d "$DB" \
  -c "DELETE FROM \"_default\".transactions WHERE ledger = '$LEDGER';"
kubectl exec -n formance-system postgresql-0 -- psql -U formance -d "$DB" \
  -c "DELETE FROM \"_default\".accounts WHERE ledger = '$LEDGER';"
```

**Tables to clean up:**
- `_system.ledgers` - ledger registry
- `_default.accounts` - account addresses
- `_default.accounts_volumes` - balances (causes duplicates in console if not cleaned)
- `_default.accounts_metadata` - account metadata
- `_default.transactions` - transactions
- `_default.transactions_metadata` - transaction metadata
- `_default.moves` - individual postings
- `_default.logs` - audit log

### Useful Queries

```bash
# Count transactions per ledger
kubectl exec -n formance-system postgresql-0 -- psql -U formance -d "yhkjzhkjctlk-txpg-ledger" \
  -c "SELECT ledger, COUNT(*) FROM \"_default\".transactions GROUP BY ledger;"

# List accounts in a ledger
kubectl exec -n formance-system postgresql-0 -- psql -U formance -d "yhkjzhkjctlk-txpg-ledger" \
  -c "SELECT address FROM \"_default\".accounts WHERE ledger = 'coins-ph-brazil';"
```

---

## Quick Reference: Full Demo Workflow

1. **Start port-forward** (if not running):
   ```bash
   kubectl port-forward -n yhkjzhkjctlk-txpg svc/gateway 8081:8080 &
   ```

2. **Run demo script**:
   ```bash
   cd /Users/finnmabie/Documents/finns-vault/Formance/Demos/Coins.ph
   ./run-demo.sh
   ```

3. **View in console**:
   ```bash
   cd /Users/finnmabie/Documents/my-local-set-up && ./start-console.sh
   # Open: http://localhost:3200/yhkjzhkjctlk/txpg/ledgers/coins-ph-brazil?region=local-dev
   ```

4. **Clean up** (if needed) - see "Deleting a Ledger" section above for full cleanup

---

## Setting Up Console Demo Mode

To use the interactive demo mode in the console, you need TWO things:

### 1. Add the demo config to the console codebase

Edit `/Users/finnmabie/Documents/my-local-set-up/platform-ui/apps/console-v3/app/hooks/useDemoMode.ts`:

- Add your demo config to the `DEMO_CONFIGS` object
- The key (e.g., `'monetae'`) must match the `demo` metadata value on the ledger

Example:
```typescript
const DEMO_CONFIGS: Record<string, DemoConfig> = {
  sportsbet: { ... },
  'coins-ph': { ... },
  monetae: {                    // <-- Add your config here
    name: 'Monetae',
    description: '...',
    accounts: [...],
    variables: {...},
    transactionSteps: [...],
    usefulQueries: [...],
  },
};
```

**If the console is already running, restart it** for changes to take effect.

### 2. Create a ledger with demo metadata

The ledger must have a `demo` metadata key matching your config:

```bash
# Port-forward gateway if not already running
kubectl port-forward -n yhkjzhkjctlk-txpg svc/gateway 8081:8080 &

# Get auth token
TOKEN=$(curl -s http://localhost:8081/api/auth/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=local-test-client&client_secret=local-test-secret" \
  | jq -r '.access_token')

# Create ledger with demo metadata
curl -X POST "http://localhost:8081/api/ledger/v2/monetae-demo" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bucket":"monetae-demo","metadata":{"demo":"monetae"}}'
```

### 3. Open the demo

Navigate to the ledger with `&demo=true`:
```
http://localhost:3200/yhkjzhkjctlk/txpg/ledgers/monetae-demo?region=local-dev&demo=true
```

### Available Demo Configs

Check `useDemoMode.ts` for current configs:
- `sportsbet` - Sports betting wallet lifecycle
- `coins-ph` - Cross-border remittance (USDT→BRL)
- `monetae` - Wealth tech fiat custody + USDC conversion

---

## Flow Diagram Rendering

The console auto-renders numscript as visual flow diagrams. Understanding how this works helps you write better demo configs.

### Flow Layouts

The diagram component detects structure automatically:

1. **Vertical Chain** (2 postings where `first.destination === second.source`)
   ```
   @customer
      ↓ $5,000
   @exchange
      ↓ 4,990 USDC
   @fireblocks
   ```

2. **Tree Layout** (one account is both destination AND source)
   - Shows inflows → intermediary → outflows vertically
   - "Related flows" section for unrelated postings
   - Intermediary account is highlighted

3. **Horizontal** (fallback for other structures)
   ```
   @source → $100 → @destination
   ```

### Amount Formatting

Amounts show with currency symbols:
- USD: `$5,000`
- BRL: `R$1,000`
- USDC: `4,990 USDC`
- TSLA: `5 TSLA`

Unknown currencies show with suffix: `100 XYZ`

### Metadata Display

Metadata keys are shown below the flow diagram:
- **Tx metadata**: Keys from `set_tx_meta()`
- **Account metadata**: Keys from `set_account_meta()`

### Writing Flows for Good Visualization

For the best tree visualization, structure your numscript so the intermediary account appears first:

```numscript
// Good - exchange is destination first, then source
send [USD/2 500000] (
  source = @customer
  destination = @exchange   // ← First: USD flows IN
)

send [USDC/6 4990000000] (
  source = @exchange        // ← Then: USDC flows OUT
  destination = @fireblocks
)
```

---

## Related

- [[Demo Building Overview]]
- [[Numscript Quick Reference]]
- [[Demo Mode Guide]] - Full reference for demo mode configuration
- Local setup: `/Users/finnmabie/Documents/my-local-set-up/README.md`
